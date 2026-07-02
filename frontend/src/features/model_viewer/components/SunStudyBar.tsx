import { Sun, X } from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { VIEWER_SUN_MARKER_COLOR } from "../lib/colorTokens";
import {
  altitudeDeg,
  azimuthDeg,
  DAYS_PER_MONTH,
  DAYS_PER_YEAR,
  dayOfYearLabel,
  decimalHourLabel,
  interpolateSunVector,
  MINUTES_PER_DAY,
  minutesLabel,
  SUN_STUDY_PRESETS,
  sunriseSunsetForDay,
} from "../lib/sunStudy";
import { useModelViewerStore } from "../store";
import type { SunPositionGridModelData } from "../types";

/** Month-initial tick rail for the date scrubber, positioned at each month's
 *  start as a fraction of the 365-day year. */
const MONTH_TICKS = (() => {
  const initials = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  let start = 0;
  return initials.map((initial, index) => {
    const tick = { initial, key: `${initial}${index}`, percent: (start / DAYS_PER_YEAR) * 100 };
    start += DAYS_PER_MONTH[index] ?? 0;
    return tick;
  });
})();

/** Track colors for the time scrubber's daylight band (PRD §4.2): night stays
 *  on the neutral surface family; daylight is the sun-study amber. */
const BAND_NIGHT = "color-mix(in oklab, var(--text-muted) 38%, var(--bg-card))";
const BAND_DAY = `color-mix(in oklab, ${VIEWER_SUN_MARKER_COLOR} 55%, var(--bg-card))`;
/** Dawn/dusk ramp width on the 24 h track, in hours. */
const BAND_TWILIGHT_HOURS = 0.75;

/**
 * The Sun-study control (PRD §4): a collapsed pill bottom-center over the
 * canvas that expands in place into the full bar — date scrubber with
 * solstice/equinox preset chips, time scrubber whose track is the day's
 * daylight band, live readout header, and the altitude/azimuth/sunrise/sunset
 * details row. Everything inside the mode is visible at once (D-6); state
 * lives in the viewer store and survives lens round-trips (D-8).
 */
export function SunStudyBar({ grid }: { grid: SunPositionGridModelData }) {
  const sunStudy = useModelViewerStore((state) => state.sunStudy);
  const engageSunStudy = useModelViewerStore((state) => state.engageSunStudy);
  const disengageSunStudy = useModelViewerStore((state) => state.disengageSunStudy);
  const setSunStudyDay = useModelViewerStore((state) => state.setSunStudyDay);
  const setSunStudyMinutes = useModelViewerStore((state) => state.setSunStudyMinutes);

  // The one amber source of truth is the TS token (scene marker, band, thumb);
  // exposed to the stylesheet as a custom property so CSS never restates it.
  const amberVar = { "--sun-study-amber": VIEWER_SUN_MARKER_COLOR } as CSSProperties;

  if (!sunStudy?.engaged) {
    return (
      <button
        type="button"
        className="sun-study-pill"
        style={amberVar}
        aria-expanded={false}
        onClick={engageSunStudy}
      >
        <Sun size={14} aria-hidden />
        Sun study
      </button>
    );
  }

  return (
    <EngagedSunStudyBar
      grid={grid}
      day={sunStudy.day}
      minutes={sunStudy.minutes}
      amberVar={amberVar}
      onClose={disengageSunStudy}
      onDayChange={setSunStudyDay}
      onMinutesChange={setSunStudyMinutes}
    />
  );
}

function EngagedSunStudyBar({
  grid,
  day,
  minutes,
  amberVar,
  onClose,
  onDayChange,
  onMinutesChange,
}: {
  grid: SunPositionGridModelData;
  day: number;
  minutes: number;
  amberVar: CSSProperties;
  onClose: () => void;
  onDayChange: (day: number) => void;
  onMinutesChange: (minutes: number) => void;
}) {
  const vector = interpolateSunVector(grid, day, minutes);
  const altitude = altitudeDeg(vector);
  const azimuth = azimuthDeg(vector, grid.true_north_deg);
  const [sunrise, sunset] = sunriseSunsetForDay(grid, day);
  // Time scrubbing re-renders per input event; the band only changes with the
  // selected day, so the gradient string is rebuilt per day, not per minute.
  const bandGradient = useMemo(() => daylightBandGradient(sunrise, sunset), [sunrise, sunset]);

  return (
    <section className="sun-study-bar" style={amberVar} aria-label="Sun study">
      <header className="sun-study-header">
        <span className="sun-study-title">
          <Sun size={14} aria-hidden />
          Sun study
        </span>
        <span className="sun-study-readout">
          {dayOfYearLabel(day)} · {minutesLabel(minutes)}
        </span>
        <button
          type="button"
          className="sun-study-close"
          aria-label="Close sun study"
          onClick={onClose}
        >
          <X size={14} aria-hidden />
        </button>
      </header>

      <div className="sun-study-row">
        <span className="sun-study-row-label" id="sun-study-date-label">
          Date
        </span>
        <div className="sun-study-slider">
          <div className="sun-study-month-rail" aria-hidden>
            {MONTH_TICKS.map((tick) => (
              <span key={tick.key} style={{ left: `${tick.percent}%` }}>
                {tick.initial}
              </span>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={DAYS_PER_YEAR}
            step={1}
            value={day}
            aria-labelledby="sun-study-date-label"
            aria-valuetext={dayOfYearLabel(day)}
            onChange={(event) => onDayChange(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="sun-study-row sun-study-chips" role="group" aria-label="Preset dates">
        {SUN_STUDY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="chip chip--md chip--outline chip--interactive sun-study-chip"
            aria-pressed={day === preset.day}
            title={preset.season}
            onClick={() => onDayChange(preset.day)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="sun-study-row">
        <span className="sun-study-row-label" id="sun-study-time-label">
          Time
        </span>
        <div className="sun-study-slider">
          <input
            type="range"
            className="sun-study-time"
            min={0}
            max={MINUTES_PER_DAY - 10}
            step={10}
            value={minutes}
            aria-labelledby="sun-study-time-label"
            aria-valuetext={minutesLabel(minutes)}
            style={{ background: bandGradient }}
            onChange={(event) => onMinutesChange(Number(event.target.value))}
          />
        </div>
      </div>

      <footer className="sun-study-details">
        <span>Alt {altitude.toFixed(1)}°</span>
        <span>Az {azimuth.toFixed(1)}°</span>
        <span>↑ {sunrise !== null ? decimalHourLabel(sunrise) : "—"}</span>
        <span>↓ {sunset !== null ? decimalHourLabel(sunset) : "—"}</span>
        <span className="sun-study-lst">LST (no DST)</span>
      </footer>
    </section>
  );
}

/**
 * The time track's daylight band: night dark, day amber, with short dawn/dusk
 * ramps around the backend-supplied sunrise/sunset (never derived by scanning
 * the grid — PRD §6.2). Polar edge cases fall back to all-night/all-day.
 */
function daylightBandGradient(sunrise: number | null, sunset: number | null): string {
  if (sunrise === null || sunset === null) {
    const all = sunrise === null && sunset === null ? BAND_NIGHT : BAND_DAY;
    return `linear-gradient(to right, ${all}, ${all})`;
  }
  const percent = (hour: number) => `${((Math.min(Math.max(hour, 0), 24) / 24) * 100).toFixed(2)}%`;
  const stops = [
    `${BAND_NIGHT} 0%`,
    `${BAND_NIGHT} ${percent(sunrise - BAND_TWILIGHT_HOURS)}`,
    `${BAND_DAY} ${percent(sunrise + BAND_TWILIGHT_HOURS)}`,
    `${BAND_DAY} ${percent(sunset - BAND_TWILIGHT_HOURS)}`,
    `${BAND_NIGHT} ${percent(sunset + BAND_TWILIGHT_HOURS)}`,
    `${BAND_NIGHT} 100%`,
  ];
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
