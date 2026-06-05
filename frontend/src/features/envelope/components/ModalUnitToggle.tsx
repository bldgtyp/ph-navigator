import type { UnitSystem } from "../../../lib/units";

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
    <div id={id} className="modal-unit-toggle" role="radiogroup" aria-label="Display units">
      {UNIT_OPTIONS.map((option) => (
        <button
          key={option}
          id={id ? `${id}-${option.toLowerCase()}` : undefined}
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
