import { NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../../energy/whoopEnergyModel.js";
import { withWhoop } from "../../_lib/withWhoop.js";

/**
 * Formats a Date as YYYY-MM-DD string (UTC).
 */
function formatDateYYYYMMDD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * GET /api/energy/whoop
 *
 * Orchestrator endpoint that:
 * 1. Fetches the most recent recovery from collection (includes sleep_id)
 * 2. Fetches sleep by sleep_id from the recovery
 * 3. Computes and returns the energy schedule
 *
 * Query params:
 *   - dayDate (optional): YYYY-MM-DD to filter recovery. Defaults to today (from Date.now()).
 *   - chronotypeOffsetHours (optional): Defaults to 0.5
 */
export const GET = withWhoop(
  async (request, ctx) => {
    const { searchParams } = new URL(request.url);

    // Parse query params with defaults
    const chronotypeOffsetHours = parseFloat(
      searchParams.get("chronotypeOffsetHours") ?? "0.5"
    );
    const dayDateParam = searchParams.get("dayDate");

    // Determine dayDate: use param or derive from Date.now()
    const now = new Date();
    const dayDate = dayDateParam || formatDateYYYYMMDD(now);

    // Build UTC window for the day
    const startOfDay = `${dayDate}T00:00:00.000Z`;
    const nextDay = new Date(`${dayDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endOfDay = nextDay.toISOString();

    // Fetch most recent recovery from collection
    const recoveryUrl = `/developer/v2/recovery?limit=1&start=${encodeURIComponent(
      startOfDay
    )}&end=${encodeURIComponent(endOfDay)}`;

    const recoveryResponse = await ctx.whoopFetch(recoveryUrl);

    if (recoveryResponse.status === 429) {
      return NextResponse.json(
        { error: "WHOOP API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (!recoveryResponse.ok) {
      const errorText = await recoveryResponse.text();
      console.error(
        `WHOOP API error (recovery collection): ${recoveryResponse.status}`,
        errorText
      );
      return NextResponse.json(
        {
          error: `WHOOP API error fetching recovery: ${recoveryResponse.status}`,
        },
        { status: recoveryResponse.status }
      );
    }

    const recoveryData = await recoveryResponse.json();

    if (!recoveryData.records || recoveryData.records.length === 0) {
      return NextResponse.json(
        { error: `No recovery found for date: ${dayDate}` },
        { status: 404 }
      );
    }

    const recovery = recoveryData.records[0];

    // Get sleep_id from recovery
    const sleepId = recovery.sleep_id;
    if (!sleepId) {
      return NextResponse.json(
        { error: "Recovery record does not contain sleep_id" },
        { status: 404 }
      );
    }

    // Fetch sleep by ID
    const sleepResponse = await ctx.whoopFetch(
      `/developer/v2/activity/sleep/${sleepId}`
    );

    if (sleepResponse.status === 404) {
      return NextResponse.json(
        { error: `Sleep record not found: ${sleepId}` },
        { status: 404 }
      );
    }

    if (sleepResponse.status === 429) {
      return NextResponse.json(
        { error: "WHOOP API rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (!sleepResponse.ok) {
      const errorText = await sleepResponse.text();
      console.error(
        `WHOOP API error (sleep): ${sleepResponse.status}`,
        errorText
      );
      return NextResponse.json(
        { error: `WHOOP API error fetching sleep: ${sleepResponse.status}` },
        { status: sleepResponse.status }
      );
    }

    const sleep = await sleepResponse.json();

    // Compute energy schedule
    try {
      const result = buildEnergyScheduleFromWhoop(sleep, recovery, {
        chronotypeOffsetHours,
        dayDate,
      });

      return NextResponse.json(result);
    } catch (err) {
      if (err.message?.includes("Invalid")) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }

      console.error("Energy model error:", err);
      return NextResponse.json(
        { error: "Internal server error computing energy schedule" },
        { status: 500 }
      );
    }
  },
  { mode: "outbound" }
);

