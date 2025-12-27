import { getSupabaseAdmin } from "./supabaseClient.js";

const CATEGORY_MAP = new Map([
  ["peak", "peak"],
  ["dip", "dip"],
  ["groggy", "groggy"],
  ["wind_down", "wind_down"],
  ["melatonin", "melatonin"],
]);

function normalizeCategory(type) {
  const mapped = CATEGORY_MAP.get(type);
  if (!mapped) {
    throw new Error(`Unsupported energy segment type: ${type}`);
  }
  return mapped;
}

function requireIso(value, field) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid ISO datetime for ${field}: ${value}`);
  }
  return new Date(ms).toISOString();
}

function buildDayWindow(dayDate) {
  const start = new Date(`${dayDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) {
    throw new Error(`Invalid dayDate: ${dayDate}`);
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Maps energy model output into rows for the energy_events table.
 *
 * @param {object} energy - EnergyModelOutput from buildEnergyScheduleFromWhoop
 * @param {string} userId - Whoop user id (or fixed id for single-user)
 * @param {string} source - Source identifier, defaults to "whoop"
 */
function toRows(energy, userId, source = "whoop") {
  if (!energy || !Array.isArray(energy.segments)) {
    throw new Error("Energy payload missing segments");
  }
  if (!userId) {
    throw new Error("userId is required to store energy events");
  }

  return energy.segments.map((segment) => ({
    user_id: userId,
    category: normalizeCategory(segment.type),
    start_at: requireIso(segment.start_iso || segment.start, "segment.start"),
    end_at: requireIso(segment.end_iso || segment.end, "segment.end"),
    start_at_formatted: segment.start, // Formatted string for display
    end_at_formatted: segment.end, // Formatted string for display
    label: segment.label || segment.type,
    source,
  }));
}

/**
 * Checks if any energy events exist for a user within the given day.
 *
 * @param {{ userId: string, dayDate: string }} params
 * @returns {Promise<boolean>}
 */
export async function hasEnergyEventsForDay({ userId, dayDate }) {
  const supabase = getSupabaseAdmin();
  const { start, end } = buildDayWindow(dayDate);

  const { data, error } = await supabase
    .from("energy_events")
    .select("id")
    .eq("user_id", userId)
    .gte("start_at", start)
    .lt("start_at", end)
    .limit(1);

  if (error) {
    throw new Error(`Supabase day check failed: ${error.message}`);
  }

  return (data?.length || 0) > 0;
}

/**
 * Upserts energy events using unique key (user_id, start_at, category).
 *
 * @param {{ energy: any, userId: string, source?: string }} params
 * @returns {Promise<{ inserted: number, rows: any[] }>}
 */
export async function upsertEnergyEvents({ energy, userId, source = "whoop" }) {
  const supabase = getSupabaseAdmin();
  const rows = toRows(energy, userId, source);

  const { data, error } = await supabase
    .from("energy_events")
    .upsert(rows, { onConflict: "user_id,start_at,category" })
    .select();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return { inserted: data?.length || 0, rows: data || [] };
}

/**
 * Stores energy events for a day, skipping insert if already present.
 *
 * @param {{ energy: any, userId: string, dayDate: string, source?: string }} params
 * @returns {Promise<{ status: "skipped" } | { status: "inserted", inserted: number, rows: any[] }>}
 */
export async function upsertEnergyEventsIfMissing({
  energy,
  userId,
  dayDate,
  source = "whoop",
}) {
  if (!dayDate) {
    throw new Error("dayDate is required to upsert energy events");
  }

  const exists = await hasEnergyEventsForDay({ userId, dayDate });

  if (exists) {
    return { status: "skipped" };
  }

  const result = await upsertEnergyEvents({ energy, userId, source });

  return { status: "inserted", ...result };
}
