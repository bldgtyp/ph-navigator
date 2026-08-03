import { useUnitPreference, type UnitSystem } from "../../lib/units";
import { SegmentedControl } from "./SegmentedControl";

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
    <SegmentedControl
      value={unitSystem}
      onChange={setUnitSystem}
      ariaLabel="Display units"
      title={error ?? undefined}
      options={UNIT_OPTIONS.map((option) => ({
        value: option,
        label: option,
        ariaLabel: `Set display units to ${option}`,
      }))}
      equalWidth
    />
  );
}
