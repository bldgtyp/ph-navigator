import { useUnitPreference, type UnitSystem } from "../../lib/units";

const UNIT_OPTIONS: UnitSystem[] = ["IP", "SI"];

// Global SI/IP toggle hosted in `WorkspaceTopbar`. Reads + writes
// `useUnitPreference`, which round-trips to `/api/v1/auth/preferences`
// so the choice persists across sessions and devices. Use this on every
// page in the app — DataTable cells with `numberUnits`, the materials
// catalog, the project document viewer, and the 3D viewer all consult
// the same preference.
export function TopbarUnitToggle() {
  const { unitSystem, setUnitSystem, error } = useUnitPreference();
  return (
    <div
      className="topbar-unit-toggle"
      role="radiogroup"
      aria-label="Display units"
      title={error ?? undefined}
    >
      {UNIT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-label={`Set display units to ${option}`}
          aria-checked={unitSystem === option}
          className={unitSystem === option ? "active" : ""}
          onClick={() => setUnitSystem(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
