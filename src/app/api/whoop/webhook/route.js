import { NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../../energy/whoopEnergyModel.js";
import { upsertEnergyEvents } from "../../_lib/energyStorage.js";
import { getAccessToken } from "../../_lib/whoopAuth.js";
import { withWhoop } from "../../_lib/withWhoop.js";
import { WhoopService } from "../../../services/whoopService.js";

const FAIL_OPEN_ON_STORAGE =
  (process.env.SUPABASE_ENERGY_FAIL_OPEN || "true").toLowerCase() !== "false";

function resolveUserId(payloadUserId) {
  return payloadUserId || process.env.WHOOP_USER_ID || "self";
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

  const dayDate = WhoopService.formatDateYYYYMMDD(new Date());
  const chronotypeOffsetHours = 0.5;

  // Create service instance with static token for webhook handling
  const whoopService = new WhoopService({ accessToken });

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
      const sleepResult = await whoopService.fetchSleepById(sleepId);
      if (sleepResult.error) {
        console.error(
          `Failed to fetch sleep ${sleepId}: ${sleepResult.status}`
        );
        return NextResponse.json(
          { error: sleepResult.error },
          { status: sleepResult.status === 404 ? 404 : 502 }
        );
      }

      sleep = sleepResult.sleep;

      // Fetch recovery from collection for today
      const recoveryResult = await whoopService.fetchRecoveryForDate(dayDate);
      if (recoveryResult.error) {
        return NextResponse.json(
          { error: recoveryResult.error },
          { status: recoveryResult.status }
        );
      }

      recovery = recoveryResult.recovery;
    } else if (type === "recovery.updated") {
      // recovery.updated: fetch most recent recovery for today from collection
      const recoveryResult = await whoopService.fetchRecoveryForDate(dayDate);
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
      const sleepResult = await whoopService.fetchSleepById(sleepId);
      if (sleepResult.error) {
        console.error(
          `Failed to fetch sleep ${sleepId}: ${sleepResult.status}`
        );
        return NextResponse.json(
          { error: sleepResult.error },
          { status: sleepResult.status === 404 ? 404 : 502 }
        );
      }

      sleep = sleepResult.sleep;
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
