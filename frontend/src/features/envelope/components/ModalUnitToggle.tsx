import type { UnitSystem } from "../../../lib/units";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";

const UNIT_OPTIONS: UnitSystem[] = ["IP", "SI"];

export function ModalUnitToggle({
  id,
  unitSystem,
  setUnitSystem,
}: {
  id?: string;
  unitSystem: UnitSystem;
  setUnitSystem: (next: UnitSystem) => void;
}) {
  return (
    <SegmentedControl
      id={id}
      value={unitSystem}
      onChange={setUnitSystem}
      ariaLabel="Display units"
      options={UNIT_OPTIONS.map((option) => ({
        value: option,
        label: option,
        ariaLabel: `Set display units to ${option}`,
        id: id ? `${id}-${option.toLowerCase()}` : undefined,
      }))}
      size="xs"
      equalWidth
    />
  );
}
