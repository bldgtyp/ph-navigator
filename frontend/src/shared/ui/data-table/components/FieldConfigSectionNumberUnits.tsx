import { useId } from "react";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import {
  NUMBER_UNIT_TYPES,
  type NumberUnitsConfig,
  type NumberIpUnit,
  type NumberSiUnit,
  type NumberUnitType,
} from "../../../../lib/units";
import {
  DEFAULT_NUMBER_PRECISION,
  MAX_NUMBER_PRECISION,
  MIN_NUMBER_PRECISION,
  clampNumberPrecision,
} from "../lib/numberPrecision";

export type FieldConfigSectionNumberUnitsProps = {
  units: NumberUnitsConfig | null;
  onUnitsChange: (units: NumberUnitsConfig | null) => void;
  disabled?: boolean;
  fixed?: boolean;
  // Section heading; a formula reuses this component under "Display units"
  // (D11 — one units UX across number and formula), a number keeps "Units".
  label?: string;
  // Optional one-line hint under the heading (formula clarifies the unit is a
  // formatting choice, not data entry).
  hint?: string;
};

const DEFAULT_UNIT_TYPE = NUMBER_UNIT_TYPES[0]!;

function defaultEditableNumberUnits(): NumberUnitsConfig {
  return unitsForType(DEFAULT_UNIT_TYPE.id, {
    mode: "editable",
    precision_si: DEFAULT_NUMBER_PRECISION,
    precision_ip: DEFAULT_NUMBER_PRECISION,
  });
}

export function FieldConfigSectionNumberUnits({
  units,
  onUnitsChange,
  disabled = false,
  fixed = false,
  label = "Units",
  hint,
}: FieldConfigSectionNumberUnitsProps) {
  const typeId = useId();
  const siUnitId = useId();
  const ipUnitId = useId();
  const precisionSiId = useId();
  const precisionIpId = useId();
  const controlsDisabled = disabled || fixed;
  const currentType = NUMBER_UNIT_TYPES.find((definition) => definition.id === units?.unit_type);

  if (!units) {
    return (
      <div className="data-table-field-config-modal-section">
        <span className="data-table-field-config-label">{label}</span>
        {hint ? <p className="data-table-field-config-modal-hint">{hint}</p> : null}
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => onUnitsChange(defaultEditableNumberUnits())}
        >
          Add units
        </button>
      </div>
    );
  }

  return (
    <div className="data-table-field-config-modal-section" role="group" aria-label={label}>
      <span className="data-table-field-config-label">{label}</span>
      {hint ? <p className="data-table-field-config-modal-hint">{hint}</p> : null}
      <label className="data-table-field-config-label" htmlFor={typeId}>
        Unit type
      </label>
      <AutocompleteSelect
        id={typeId}
        className="data-table-add-field-input"
        value={units.unit_type}
        disabled={controlsDisabled}
        compact
        options={NUMBER_UNIT_TYPES.map((definition) => ({
          value: definition.id,
          label: definition.label,
        }))}
        onChange={(unitType) =>
          onUnitsChange(
            unitsForType(unitType as NumberUnitType, {
              mode: units.mode,
              precision_si: units.precision_si,
              precision_ip: units.precision_ip,
            }),
          )
        }
      />
      <div className="data-table-field-config-modal-inline-grid">
        <label className="data-table-field-config-label" htmlFor={siUnitId}>
          SI unit
        </label>
        <AutocompleteSelect
          id={siUnitId}
          className="data-table-add-field-input"
          value={units.si_unit}
          disabled={controlsDisabled}
          compact
          options={(currentType ?? DEFAULT_UNIT_TYPE).siUnits.map((unit) => ({
            value: unit.id,
            label: unit.label,
          }))}
          onChange={(siUnit) => onUnitsChange({ ...units, si_unit: siUnit as NumberSiUnit })}
        />
        <label className="data-table-field-config-label" htmlFor={ipUnitId}>
          IP unit
        </label>
        <AutocompleteSelect
          id={ipUnitId}
          className="data-table-add-field-input"
          value={units.ip_unit}
          disabled={controlsDisabled}
          compact
          options={(currentType ?? DEFAULT_UNIT_TYPE).ipUnits.map((unit) => ({
            value: unit.id,
            label: unit.label,
          }))}
          onChange={(ipUnit) => onUnitsChange({ ...units, ip_unit: ipUnit as NumberIpUnit })}
        />
        <label className="data-table-field-config-label" htmlFor={precisionSiId}>
          SI decimal precision
        </label>
        <input
          id={precisionSiId}
          type="number"
          className="data-table-add-field-input"
          min={MIN_NUMBER_PRECISION}
          max={MAX_NUMBER_PRECISION}
          step={1}
          value={units.precision_si}
          disabled={controlsDisabled}
          onChange={(event) =>
            onUnitsChange({
              ...units,
              precision_si: clampNumberPrecision(event.currentTarget.value),
            })
          }
        />
        <label className="data-table-field-config-label" htmlFor={precisionIpId}>
          IP decimal precision
        </label>
        <input
          id={precisionIpId}
          type="number"
          className="data-table-add-field-input"
          min={MIN_NUMBER_PRECISION}
          max={MAX_NUMBER_PRECISION}
          step={1}
          value={units.precision_ip}
          disabled={controlsDisabled}
          onChange={(event) =>
            onUnitsChange({
              ...units,
              precision_ip: clampNumberPrecision(event.currentTarget.value),
            })
          }
        />
      </div>
      {fixed ? (
        <p className="data-table-field-config-modal-hint">Units are fixed by this catalog field.</p>
      ) : (
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => onUnitsChange(null)}
        >
          Remove units
        </button>
      )}
    </div>
  );
}

function unitsForType(
  unitType: NumberUnitType,
  options: Pick<NumberUnitsConfig, "mode" | "precision_si" | "precision_ip">,
): NumberUnitsConfig {
  const definition = NUMBER_UNIT_TYPES.find((candidate) => candidate.id === unitType);
  const selected = definition ?? DEFAULT_UNIT_TYPE;
  return {
    mode: options.mode,
    unit_type: selected.id,
    si_unit: selected.siUnits[0]!.id,
    ip_unit: selected.ipUnits[0]!.id,
    precision_si: options.precision_si,
    precision_ip: options.precision_ip,
  };
}
