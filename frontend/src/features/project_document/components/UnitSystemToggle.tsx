import { useUnitPreference, type UnitSystem } from "../../../lib/units";

const OPTIONS: UnitSystem[] = ["IP", "SI"];

export function UnitSystemToggle() {
  const { unitSystem, error, setUnitSystem } = useUnitPreference();
  return (
    <div className="unit-system-toggle-wrap">
      <div
        className="unit-system-toggle"
        role="radiogroup"
        aria-label="Display units"
        data-tooltip={`Display units: ${unitSystem}`}
      >
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === unitSystem ? "active" : ""}
            role="radio"
            aria-checked={option === unitSystem}
            onClick={() => setUnitSystem(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {error ? (
        <span className="unit-system-toggle-error" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
