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
    start_at: requireIso(segment.start, "segment.start"),
    end_at: requireIso(segment.end, "segment.end"),
    label: segment.label || segment.type,
    source,
  }));
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
