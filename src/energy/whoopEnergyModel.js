/**
 * WHOOP → Energy model (pure, fixtures-friendly).
 * Implements the strategy described in `.devnotes/energy-model-strategy.md`.
 */

const HOUR_MS = 3_600_000;

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function parseTimezoneOffsetMinutes(offset) {
  // Expected formats like "-05:00", "+01:30"
  if (typeof offset !== "string") return 0;
  const m = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return sign * (hh * 60 + mm);
}

function formatIsoWithOffset(utcMs, offsetMinutes) {
  // Convert absolute UTC time into local wall time with explicit offset.
  const local = new Date(utcMs + offsetMinutes * 60_000);
  const pad2 = (n) => String(n).padStart(2, "0");
  const pad3 = (n) => String(n).padStart(3, "0");

  const y = local.getUTCFullYear();
  const mo = pad2(local.getUTCMonth() + 1);
  const d = pad2(local.getUTCDate());
  const h = pad2(local.getUTCHours());
  const mi = pad2(local.getUTCMinutes());
  const s = pad2(local.getUTCSeconds());
  const ms = pad3(local.getUTCMilliseconds());

  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const oh = pad2(Math.floor(abs / 60));
  const om = pad2(abs % 60);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}${sign}${oh}:${om}`;
}

function format12HourEST(utcMs) {
  // Convert UTC timestamp to US EST/EDT timezone and format as 12-hour time
  const estDate = new Date(utcMs);
  
  // Use Intl.DateTimeFormat to format in EST/EDT timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const parts = formatter.formatToParts(estDate);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;
  
  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const dayNum = parseInt(day);
  let suffix = 'th';
  if (dayNum % 10 === 1 && dayNum % 100 !== 11) suffix = 'st';
  else if (dayNum % 10 === 2 && dayNum % 100 !== 12) suffix = 'nd';
  else if (dayNum % 10 === 3 && dayNum % 100 !== 13) suffix = 'rd';
  
  return `${weekday}, ${month} ${day}${suffix} ${hour}:${minute}${dayPeriod.toUpperCase()}`;
}

function getNumber(pathValue, fallback = 0) {
  const n = Number(pathValue);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @typedef {"groggy"|"peak"|"dip"|"wind_down"|"melatonin"} EnergySegmentType
 * @typedef {{label:string,type:EnergySegmentType,start:string,end:string,start_iso?:string,end_iso?:string,energy:number}} EnergySegment
 * @typedef {"push"|"balanced"|"conserve"} DayMode
 * @typedef {{
 *  wakeTime: string,
 *  wakeTime_iso?: string,
 *  sleepDurationHours: number,
 *  sleepDebtHours: number,
 *  sleepPerf: number,
 *  recoveryScore: number,
 *  dayMode: DayMode,
 *  overallCapacity: number,
 *  segments: EnergySegment[]
 * }} EnergyModelOutput
 */

/**
 * @param {any} sleep WHOOP sleep record (v2-like)
 * @param {any} recovery WHOOP recovery record (v2-like)
 * @param {{chronotypeOffsetHours?: number, dayDate?: string}} config
 * @returns {EnergyModelOutput}
 */
export function buildEnergyScheduleFromWhoop(sleep, recovery, config = {}) {
  const chronotypeOffsetHours = getNumber(config.chronotypeOffsetHours, 0);

  const sleepStartUtcMs = Date.parse(sleep?.start);
  const sleepEndUtcMs = Date.parse(sleep?.end);
  if (!Number.isFinite(sleepStartUtcMs) || !Number.isFinite(sleepEndUtcMs)) {
    throw new Error("Invalid sleep.start or sleep.end (expected ISO datetime)");
  }

  const timezoneOffset =
    typeof sleep?.timezone_offset === "string"
      ? sleep.timezone_offset
      : "+00:00";
  const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(timezoneOffset);

  const wakeUtcMs = sleepEndUtcMs;
  const internalWakeUtcMs = wakeUtcMs + chronotypeOffsetHours * HOUR_MS;

  const sleepDurationHours = (sleepEndUtcMs - sleepStartUtcMs) / HOUR_MS;

  const needFromDebtMilli =
    sleep?.score?.sleep_needed?.need_from_sleep_debt_milli;
  const sleepDebtHours = getNumber(needFromDebtMilli, 0) / HOUR_MS;

  const sleepPerf = getNumber(sleep?.score?.sleep_performance_percentage, 0);
  const sleepConsistency = getNumber(
    sleep?.score?.sleep_consistency_percentage,
    0
  );

  const recoveryScore = getNumber(recovery?.score?.recovery_score, 0);

  const qualityFactor = clamp(
    0.5 * (sleepPerf / 100) + 0.5 * (recoveryScore / 100),
    0,
    1
  );
  const debtFactor = clamp(sleepDebtHours / 3, 0, 1);
  const fatigueFactor = 1 - qualityFactor;

  // Modulation knobs from the strategy doc
  const peakDelayHours = 0.5 * fatigueFactor; // max 0.5h
  const peakShrinkRatio = 1 - 0.3 * fatigueFactor; // 0.7..1
  const lowEnergyExtendRatio = 1 + 0.5 * debtFactor; // 1..1.5

  // Base circadian durations (hours)
  const baseGroggyH = 1.5;
  const baseMorningPeakH = 5.0 - 1.5; // 3.5
  const baseAfternoonDipH = 8.0 - 5.0; // 3
  const baseEveningPeakH = 11.0 - 8.0; // 3
  const baseWindDownH = 13.0 - 11.0; // 2

  // Implement “delay peaks” without creating gaps by extending the preceding low-energy windows.
  const groggyDurationMs =
    (baseGroggyH * lowEnergyExtendRatio + peakDelayHours) * HOUR_MS;
  const morningPeakDurationMs = baseMorningPeakH * peakShrinkRatio * HOUR_MS;
  const afternoonDipDurationMs =
    (baseAfternoonDipH * lowEnergyExtendRatio + peakDelayHours) * HOUR_MS;
  const eveningPeakDurationMs = baseEveningPeakH * peakShrinkRatio * HOUR_MS;

  // Wind-down: modeled duration (no artificial cap)
  const windDownDurationMs = baseWindDownH * HOUR_MS;

  const segmentsUtc = [];
  let cursorUtcMs = internalWakeUtcMs;

  const pushSeg = (label, type, durationMs) => {
    const startUtcMs = cursorUtcMs;
    const endUtcMs = startUtcMs + durationMs;
    cursorUtcMs = endUtcMs;
    segmentsUtc.push({ label, type, startUtcMs, endUtcMs });
  };

  pushSeg("Groggy", "groggy", groggyDurationMs);
  pushSeg("Morning Peak", "peak", morningPeakDurationMs);
  pushSeg("Afternoon Dip", "dip", afternoonDipDurationMs);
  pushSeg("Evening Peak", "peak", eveningPeakDurationMs);
  pushSeg("Wind-Down", "wind_down", windDownDurationMs);

  // Melatonin window: 80% of wind-down duration immediately after wind-down (sleep start not required)
  const windDownSeg = segmentsUtc[segmentsUtc.length - 1];
  const melatoninStartUtcMs = windDownSeg.endUtcMs;
  const melatoninEndUtcMs = melatoninStartUtcMs + 0.8 * windDownDurationMs;

  // Energy scoring (0–1)
  const baseE = {
    groggy: 0.3,
    peak: 0.9,
    dip: 0.4,
    wind_down: 0.3,
    melatonin: 0.2,
  };

  const scaleEnergy = (base, isLowEnergy) => {
    let x = base * qualityFactor;
    if (isLowEnergy) x *= 1 - 0.3 * debtFactor;
    return clamp(x, 0, 1);
  };

  const overallCapacity = clamp(
    100 *
      (0.5 * qualityFactor +
        0.3 * (1 - debtFactor) +
        0.2 * (sleepConsistency / 100)),
    0,
    100
  );

  /** @type {DayMode} */
  let dayMode;
  if (overallCapacity >= 75) dayMode = "push";
  else if (overallCapacity >= 55) dayMode = "balanced";
  else dayMode = "conserve";

  /** @type {EnergySegment[]} */
  const segments = segmentsUtc.map((s) => {
    const isLowEnergy = s.type !== "peak";
    const startIso = formatIsoWithOffset(s.startUtcMs, timezoneOffsetMinutes);
    const endIso = formatIsoWithOffset(s.endUtcMs, timezoneOffsetMinutes);
    const startFormatted = format12HourEST(s.startUtcMs);
    const endFormatted = format12HourEST(s.endUtcMs);
    
    return {
      label: s.label,
      type: s.type,
      start: startFormatted,  // Formatted for API response
      end: endFormatted,      // Formatted for API response
      start_iso: startIso,    // ISO for database storage
      end_iso: endIso,        // ISO for database storage
      energy: scaleEnergy(baseE[s.type], isLowEnergy),
    };
  });

  // Melatonin window: 80% of wind-down duration immediately after wind-down
  const melatoninStartIso = formatIsoWithOffset(melatoninStartUtcMs, timezoneOffsetMinutes);
  const melatoninEndIso = formatIsoWithOffset(melatoninEndUtcMs, timezoneOffsetMinutes);
  segments.push({
    label: "Melatonin Window",
    type: "melatonin",
    start: format12HourEST(melatoninStartUtcMs),
    end: format12HourEST(melatoninEndUtcMs),
    start_iso: melatoninStartIso,
    end_iso: melatoninEndIso,
    energy: scaleEnergy(baseE.melatonin, true),
  });

  // Validate segment contiguity (includes melatonin as the final segment)
  // Use ISO timestamps for validation since formatted strings can't be parsed as dates
  const mainSegments = segments;
  for (let i = 0; i < mainSegments.length - 1; i++) {
    const curr = mainSegments[i];
    const next = mainSegments[i + 1];
    const currEnd = new Date(curr.end_iso).getTime();
    const nextStart = new Date(next.start_iso).getTime();
    const gap = nextStart - currEnd;

    if (Math.abs(gap) > 1000) {
      throw new Error(
        `Segments not contiguous: ${curr.label}.end (${curr.end_iso}) != ${next.label}.start (${next.start_iso}), gap: ${gap}ms`
      );
    }
  }

  // Validate melatonin is contiguous with wind-down (melatonin starts when wind-down ends)
  const windDownSegFormatted = segments.find((s) => s.type === "wind_down");
  const melatoninSeg = segments.find((s) => s.type === "melatonin");
  if (windDownSegFormatted && melatoninSeg) {
    const windDownEnd = new Date(windDownSegFormatted.end_iso).getTime();
    const melatoninStart = new Date(melatoninSeg.start_iso).getTime();
    const gap = Math.abs(melatoninStart - windDownEnd);
    if (gap > 1000) {
      throw new Error(
        `Melatonin not contiguous with wind-down: wind-down ends at ${windDownSegFormatted.end_iso}, melatonin starts at ${melatoninSeg.start_iso}, gap: ${gap}ms`
      );
    }
  }

  // Validate energy scores are in range [0, 1]
  for (const seg of segments) {
    if (seg.energy < 0 || seg.energy > 1) {
      throw new Error(
        `Invalid energy score for ${seg.label}: ${seg.energy} (must be 0-1)`
      );
    }
  }

  const wakeTimeIso = formatIsoWithOffset(wakeUtcMs, timezoneOffsetMinutes);
  const wakeTimeFormatted = format12HourEST(wakeUtcMs);
  
  return {
    wakeTime: wakeTimeFormatted,  // Formatted for API response
    wakeTime_iso: wakeTimeIso,    // ISO for database storage
    sleepDurationHours,
    sleepDebtHours,
    sleepPerf,
    recoveryScore,
    dayMode,
    overallCapacity,
    segments,
  };
}
