import { NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../../energy/whoopEnergyModel.js";
import { withWhoop } from "../../_lib/withWhoop.js";
import { WhoopService } from "../../../services/whoopService.js";

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
    const dayDate = dayDateParam || WhoopService.formatDateYYYYMMDD(now);

    // Service provided by withWhoop middleware
    const whoopService = ctx.whoopService;

    // Fetch most recent recovery from collection
    const recoveryResult = await whoopService.fetchRecoveryForDate(dayDate);

    if (recoveryResult.error) {
      return NextResponse.json(
        { error: recoveryResult.error },
        { status: recoveryResult.status }
      );
    }

    const recovery = recoveryResult.recovery;

    // Get sleep_id from recovery
    const sleepId = recovery.sleep_id;
    if (!sleepId) {
      return NextResponse.json(
        { error: "Recovery record does not contain sleep_id" },
        { status: 404 }
      );
    }

    // Fetch sleep by ID
    const sleepResult = await whoopService.fetchSleepById(sleepId);

    if (sleepResult.error) {
      return NextResponse.json(
        { error: sleepResult.error },
        { status: sleepResult.status }
      );
    }

    const sleep = sleepResult.sleep;

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
