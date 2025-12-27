import { NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../../energy/whoopEnergyModel.js";
import { upsertEnergyEvents } from "../../_lib/energyStorage.js";
import { getAccessToken } from "../../_lib/whoopAuth.js";
import { withWhoop } from "../../_lib/withWhoop.js";

const WHOOP_API_BASE = "https://api.prod.whoop.com";
const FAIL_OPEN_ON_STORAGE =
  (process.env.SUPABASE_ENERGY_FAIL_OPEN || "true").toLowerCase() !== "false";

/**
 * Formats a Date as YYYY-MM-DD string (UTC).
 */
function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveUserId(payloadUserId) {
  return payloadUserId || process.env.WHOOP_USER_ID || "self";
}

/**
 * Helper to make authenticated WHOOP API requests.
 * Used inside the webhook handler after signature validation.
 */
async function whoopApiFetch(path, accessToken) {
  const url = path.startsWith("http") ? path : `${WHOOP_API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response;
}

/**
 * Fetches the most recent recovery using a date window (defaults to today).
 */
async function fetchRecoveryForDate(accessToken, dayDate) {
  const startOfDay = `${dayDate}T00:00:00.000Z`;
  const nextDay = new Date(`${dayDate}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const endOfDay = nextDay.toISOString();

  const recoveryUrl = `/developer/v2/recovery?limit=1&start=${encodeURIComponent(
    startOfDay
  )}&end=${encodeURIComponent(endOfDay)}`;

  const response = await whoopApiFetch(recoveryUrl, accessToken);

  if (!response.ok) {
    return {
      error: `Recovery fetch failed: ${response.status}`,
      status: response.status,
    };
  }

  const data = await response.json();

  if (!data.records || data.records.length === 0) {
    return { error: `No recovery found for date: ${dayDate}`, status: 404 };
  }

  return { recovery: data.records[0] };
}

/**
 * POST /api/whoop/webhook
 *
 * Inbound webhook receiver for WHOOP events.
 * Validates X-WHOOP-Signature, then uses OAuth to fetch canonical
 * sleep+recovery data and compute the energy schedule.
 *
 * Supported event types:
 *   - sleep.updated: uses body.id as sleepId
 *   - recovery.updated: uses body.cycle_id or falls back to today's cycle
 *
 * Response:
 *   - 200 with { status, trace_id, energy? }
 */
export const POST = withWhoop(async (request, ctx) => {
  const body = ctx.json;
  const { type, id, user_id, trace_id } = body;

  if (!type) {
    return NextResponse.json(
      { error: "Missing required field: type" },
      { status: 400 }
    );
  }

  // Only handle sleep.updated and recovery.updated
  if (type !== "sleep.updated" && type !== "recovery.updated") {
    return NextResponse.json({
      status: "ignored",
      message: `Event type '${type}' not handled`,
      trace_id,
    });
  }

  // Get OAuth access token for outbound API calls
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error("OAuth token error in webhook handler:", err);
    return NextResponse.json(
      {
        error: "Authentication required for WHOOP API calls",
        hint: "Visit /api/auth/whoop/authorize to authorize the application",
      },
      { status: 401 }
    );
  }

  const dayDate = formatDateYYYYMMDD(new Date());
  const chronotypeOffsetHours = 0.5;

  let sleep;
  let recovery;

  try {
    if (type === "sleep.updated") {
      // sleep.updated: id is the sleepId
      const sleepId = id;
      if (!sleepId) {
        return NextResponse.json(
          { error: "sleep.updated event missing id (sleepId)" },
          { status: 400 }
        );
      }

      // Fetch sleep
      const sleepResponse = await whoopApiFetch(
        `/developer/v2/activity/sleep/${sleepId}`,
        accessToken
      );

      if (!sleepResponse.ok) {
        console.error(
          `Failed to fetch sleep ${sleepId}: ${sleepResponse.status}`
        );
        return NextResponse.json(
          { error: `Failed to fetch sleep: ${sleepResponse.status}` },
          { status: sleepResponse.status === 404 ? 404 : 502 }
        );
      }

      sleep = await sleepResponse.json();

      // Fetch recovery from collection for today
      const recoveryResult = await fetchRecoveryForDate(accessToken, dayDate);
      if (recoveryResult.error) {
        return NextResponse.json(
          { error: recoveryResult.error },
          { status: recoveryResult.status }
        );
      }

      recovery = recoveryResult.recovery;
    } else if (type === "recovery.updated") {
      // recovery.updated: fetch most recent recovery for today from collection
      const recoveryResult = await fetchRecoveryForDate(accessToken, dayDate);
      if (recoveryResult.error) {
        return NextResponse.json(
          { error: recoveryResult.error },
          { status: recoveryResult.status }
        );
      }

      recovery = recoveryResult.recovery;

      // Get sleepId from recovery.sleep_id
      const sleepId = recovery.sleep_id;
      if (!sleepId) {
        return NextResponse.json(
          { error: "Recovery record does not contain sleep_id" },
          { status: 404 }
        );
      }

      // Fetch sleep
      const sleepResponse = await whoopApiFetch(
        `/developer/v2/activity/sleep/${sleepId}`,
        accessToken
      );

      if (!sleepResponse.ok) {
        console.error(
          `Failed to fetch sleep ${sleepId}: ${sleepResponse.status}`
        );
        return NextResponse.json(
          { error: `Failed to fetch sleep: ${sleepResponse.status}` },
          { status: sleepResponse.status === 404 ? 404 : 502 }
        );
      }

      sleep = await sleepResponse.json();
    }

    // Compute energy schedule
    const energy = buildEnergyScheduleFromWhoop(sleep, recovery, {
      chronotypeOffsetHours,
      dayDate,
    });

    // Persist to Supabase (fail-open by default to keep webhook fast)
    const storageUserId = resolveUserId(user_id);
    let storage = { inserted: 0 };
    try {
      storage = await upsertEnergyEvents({
        energy,
        userId: storageUserId,
        source: "whoop:webhook",
      });
    } catch (err) {
      console.error("Energy storage error:", err);
      if (!FAIL_OPEN_ON_STORAGE) {
        return NextResponse.json(
          { error: "Failed to persist energy events", trace_id },
          { status: 502 }
        );
      }
      storage = { error: err.message };
    }

    // Return success with energy schedule + storage status
    return NextResponse.json({
      status: "processed",
      trace_id,
      user_id: storageUserId,
      event_type: type,
      energy,
      storage,
    });
  } catch (err) {
    if (err.message?.includes("Invalid")) {
      return NextResponse.json(
        { error: err.message, trace_id },
        { status: 400 }
      );
    }

    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Internal server error processing webhook", trace_id },
      { status: 500 }
    );
  }
});
