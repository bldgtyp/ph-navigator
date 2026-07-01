import type { SunPositionGridModelData } from "../types";

/**
 * Display-level derivations from the backend solar-position grid (PRD §6.2).
 * Everything here restates backend-computed values — interpolating between
 * adjacent grid vectors, converting a vector to readout angles, formatting
 * labels. No new domain math (the hard rule): the grid is the sole source of
 * truth, and at any whole hour the derived direction equals the grid vector
 * exactly.
 */

export type SunVector = [number, number, number];

export const MINUTES_PER_DAY = 24 * 60;
export const DAYS_PER_YEAR = 365;

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Solstice/equinox preset chips (PRD D-9), as day-of-year on the fixed
 *  non-leap calendar, in calendar order. */
export const SUN_STUDY_PRESETS: { day: number; label: string; season: string }[] = [
  { day: dayOfYear(12, 21), label: "Dec 21", season: "Winter solstice" },
  { day: dayOfYear(3, 20), label: "Mar 20", season: "Spring equinox" },
  { day: dayOfYear(6, 21), label: "Jun 21", season: "Summer solstice" },
  { day: dayOfYear(9, 22), label: "Sep 22", season: "Fall equinox" },
];

/** The sun light's intensity ramp near the horizon: full above ~4° altitude,
 *  zero at 0°, smooth in between — dusk dies off instead of popping (D-3). */
export const SUN_HORIZON_RAMP_DEGREES = 4;

/** Day-of-year (1..365) for a month/day on the fixed non-leap calendar. */
export function dayOfYear(month: number, day: number): number {
  let total = day;
  for (let m = 0; m < month - 1; m += 1) total += DAYS_PER_MONTH[m] ?? 0;
  return total;
}

/** Today's month/day mapped onto the grid's non-leap calendar (Feb 29 → Feb 28). */
export function todayDayOfYear(now: Date = new Date()): number {
  const month = now.getMonth() + 1;
  const day = Math.min(now.getDate(), DAYS_PER_MONTH[now.getMonth()] ?? 31);
  return dayOfYear(month, day);
}

/** "Jun 21" for a day-of-year on the non-leap calendar. */
export function dayOfYearLabel(day: number): string {
  let remaining = Math.min(Math.max(Math.round(day), 1), DAYS_PER_YEAR);
  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = DAYS_PER_MONTH[month] ?? 31;
    if (remaining <= daysInMonth) return `${MONTH_LABELS[month]} ${remaining}`;
    remaining -= daysInMonth;
  }
  return `Dec 31`;
}

/** "14:30" for minutes-of-day. */
export function minutesLabel(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), MINUTES_PER_DAY - 1);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "05:24" for a decimal-hours value (sunrise/sunset readouts). */
export function decimalHourLabel(hour: number): string {
  return minutesLabel(hour * 60);
}

function gridVector(grid: SunPositionGridModelData, day: number, hour: number): SunVector {
  return grid.unit_vectors[(day - 1) * grid.hours.length + hour] ?? [0, 0, -1];
}

/**
 * The sun direction at (day, minutes): a normalized lerp of the two adjacent
 * whole-hour grid vectors. Vectors interpolate cleanly through midnight-side
 * hours and sunrise/sunset (no azimuth-wraparound pathology — the reason the
 * wire format is vectors, not angle pairs). The 23:00→24:00 tail holds at the
 * 23:00 vector; the sun is far below the horizon then at any project
 * latitude, so the clamp is invisible.
 */
export function interpolateSunVector(
  grid: SunPositionGridModelData,
  day: number,
  minutes: number,
): SunVector {
  const hour = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY - 1) / 60;
  const lower = Math.floor(hour);
  const upper = Math.min(lower + 1, grid.hours.length - 1);
  const t = upper === lower ? 0 : hour - lower;
  const [ax, ay, az] = gridVector(grid, day, lower);
  const [bx, by, bz] = gridVector(grid, day, upper);
  const x = ax + (bx - ax) * t;
  const y = ay + (by - ay) * t;
  const z = az + (bz - az) * t;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** Altitude above the horizon, degrees — a restatement of the vector. */
export function altitudeDeg(vector: SunVector): number {
  return (Math.asin(Math.min(Math.max(vector[2], -1), 1)) * 180) / Math.PI;
}

/**
 * Compass azimuth, degrees clockwise from true north (0 = N, 90 = E). The
 * grid vectors live in the dome frame, which ladybug rotates CCW by
 * `true_north_deg`; undoing that rotation restates the vector against true
 * north.
 */
export function azimuthDeg(vector: SunVector, trueNorthDeg: number): number {
  const frameAzimuth = (Math.atan2(vector[0], vector[1]) * 180) / Math.PI;
  return (((frameAzimuth + trueNorthDeg) % 360) + 360) % 360;
}

/** 0..1 factor for the sun light near the horizon: smoothstep(0°, ~4°). */
export function sunIntensityFactor(altitude: number): number {
  const t = Math.min(Math.max(altitude / SUN_HORIZON_RAMP_DEGREES, 0), 1);
  return t * t * (3 - 2 * t);
}

/** The backend-supplied (sunrise, sunset) pair for a day, decimal hours LST. */
export function sunriseSunsetForDay(
  grid: SunPositionGridModelData,
  day: number,
): [number | null, number | null] {
  return grid.sunrise_sunset[day - 1] ?? [null, null];
}
