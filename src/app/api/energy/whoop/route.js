import { NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../../energy/whoopEnergyModel.js";
import { upsertEnergyEventsIfMissing } from "../../_lib/storage/energyStorage.js";
import { withWhoop } from "../../_lib/whoop/withWhoop.js";
import { WhoopService } from "../../../../services/whoopService.js";
import { APP_USER_ID } from "@/config";

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
    const now = new Date();
    const dayDate = WhoopService.formatDateYYYYMMDD(now);
    const chronotypeOffsetHours = 0.5;

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

      const storageUserId = APP_USER_ID;
      let storage = { status: "skipped" };

      try {
        storage = await upsertEnergyEventsIfMissing({
          energy: result,
          userId: storageUserId,
          dayDate,
          source: "whoop:get",
        });
      } catch (err) {
        console.error("Energy storage error:", err);
        return NextResponse.json(
          { error: "Failed to persist energy events" },
          { status: 502 }
        );
      }

      return NextResponse.json({ energy: result, storage });
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
