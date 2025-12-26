import { NextRequest, NextResponse } from "next/server";
import { buildEnergyScheduleFromWhoop } from "../../../energy/whoopEnergyModel.js";
import { withWhoop } from "../_lib/withWhoop.js";

/**
 * POST /api/energy
 *
 * Body: { sleep, recovery, chronotypeOffsetHours?, dayDate? }
 * Returns: EnergyModelOutput JSON
 *
 * Requires WHOOP webhook signature validation via X-WHOOP-Signature header.
 */
export const POST = withWhoop(async (request, ctx) => {
  const body = ctx.json;
  const { sleep, recovery, chronotypeOffsetHours = 0.5, dayDate } = body;

  if (!sleep || !recovery) {
    return NextResponse.json(
      { error: "Missing required fields: sleep and recovery" },
      { status: 400 }
    );
  }

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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
