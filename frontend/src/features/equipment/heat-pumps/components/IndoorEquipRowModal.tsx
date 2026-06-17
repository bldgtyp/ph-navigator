import { useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  ModalSingleSelectField,
  NumberField,
  RowEditGrid,
  RowEditModal,
  RowEditSection,
  TextAreaField,
  TextField,
} from "../../../../shared/ui/data-table";
import { tagCollides } from "../lib";
import { HEAT_PUMP_OPTION_KEYS, type HeatPumpIndoorEquipRow, type HeatPumpsSlice } from "../types";

export function IndoorEquipRowModal({
  mode,
  row,
  existingEquip = [],
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateOption,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpIndoorEquipRow;
  existingEquip?: HeatPumpIndoorEquipRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  onCreateOption?: (
    optionKey:
      | typeof HEAT_PUMP_OPTION_KEYS.manufacturer
      | typeof HEAT_PUMP_OPTION_KEYS.modelType
      | typeof HEAT_PUMP_OPTION_KEYS.installType,
    label: string,
  ) => Promise<string>;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const manufacturerOptions = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const modelTypeOptions = options[HEAT_PUMP_OPTION_KEYS.modelType] ?? [];
  const installTypeOptions = options[HEAT_PUMP_OPTION_KEYS.installType] ?? [];
  const title =
    mode === "add" ? "New indoor equipment" : `Indoor equipment: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create indoor equipment" : "Save indoor equipment";

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingEquip, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another indoor equipment row.`);
      return;
    }
    if (negativeNumber(draft.nominal_tons, { strictlyPositive: true })) {
      setError("Nominal tons must be greater than 0 when set.");
      return;
    }
    if (
      negativeNumber(draft.fan_speed_cfm) ||
      negativeNumber(draft.cooling_btuh) ||
      negativeNumber(draft.heating_btuh_47f) ||
      negativeNumber(draft.heating_btuh_17f) ||
      negativeNumber(draft.heating_cop) ||
      negativeNumber(draft.seer) ||
      negativeNumber(draft.eer) ||
      negativeNumber(draft.hspf)
    ) {
      setError("Numeric fields must be 0 or greater when set.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
        model_number: draft.model_number?.trim() || null,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save indoor equipment."));
      setIsSaving(false);
    }
  };

  return (
    <RowEditModal
      title={title}
      titleId="hp-indoor-equip-title"
      onCancel={onCancel}
      onSubmit={() => void save()}
      onDelete={onDelete}
      deleteLabel="Delete indoor equipment"
      error={error}
      isSaving={isSaving}
      readOnly={readOnly}
      submitLabel={submitLabel}
    >
      <RowEditSection title="Identity">
        <RowEditGrid>
          <TextField
            label="Tag"
            value={draft.tag}
            onChange={(tag) => setDraft({ ...draft, tag: tag ?? "" })}
            disabled={readOnly}
          />
          <ModalSingleSelectField
            label="Manufacturer"
            value={draft.manufacturer}
            options={manufacturerOptions}
            onChange={(manufacturer) => setDraft({ ...draft, manufacturer })}
            onCreate={
              onCreateOption
                ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.manufacturer, label)
                : undefined
            }
            disabled={readOnly}
          />
          <ModalSingleSelectField
            label="Model type"
            value={draft.model_type}
            options={modelTypeOptions}
            onChange={(model_type) => setDraft({ ...draft, model_type })}
            onCreate={
              onCreateOption
                ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.modelType, label)
                : undefined
            }
            disabled={readOnly}
          />
          <TextField
            label="Model number"
            value={draft.model_number ?? ""}
            onChange={(model_number) => setDraft({ ...draft, model_number })}
            disabled={readOnly}
          />
          <ModalSingleSelectField
            label="Install type"
            value={draft.install_type}
            options={installTypeOptions}
            onChange={(install_type) => setDraft({ ...draft, install_type })}
            onCreate={
              onCreateOption
                ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.installType, label)
                : undefined
            }
            disabled={readOnly}
          />
        </RowEditGrid>
      </RowEditSection>
      <RowEditSection title="Performance">
        <RowEditGrid>
          <NumberField
            label="Nominal tons"
            value={draft.nominal_tons}
            step={0.01}
            onChange={(nominal_tons) => setDraft({ ...draft, nominal_tons })}
            disabled={readOnly}
          />
          <NumberField
            label="Fan speed (CFM)"
            value={draft.fan_speed_cfm}
            onChange={(fan_speed_cfm) => setDraft({ ...draft, fan_speed_cfm })}
            disabled={readOnly}
          />
          <NumberField
            label="Cooling capacity (kW)"
            value={draft.cooling_btuh}
            onChange={(cooling_btuh) => setDraft({ ...draft, cooling_btuh })}
            disabled={readOnly}
          />
          <NumberField
            label="Heating capacity (kW)"
            value={draft.heating_btuh_47f}
            onChange={(heating_btuh_47f) => setDraft({ ...draft, heating_btuh_47f })}
            disabled={readOnly}
          />
          <NumberField
            label="Heating Btu/h at 17F"
            value={draft.heating_btuh_17f}
            onChange={(heating_btuh_17f) => setDraft({ ...draft, heating_btuh_17f })}
            disabled={readOnly}
          />
          <NumberField
            label="Heating COP"
            value={draft.heating_cop}
            step={0.01}
            onChange={(heating_cop) => setDraft({ ...draft, heating_cop })}
            disabled={readOnly}
          />
          <NumberField
            label="SEER"
            value={draft.seer}
            step={0.01}
            onChange={(seer) => setDraft({ ...draft, seer })}
            disabled={readOnly}
          />
          <NumberField
            label="EER"
            value={draft.eer}
            step={0.01}
            onChange={(eer) => setDraft({ ...draft, eer })}
            disabled={readOnly}
          />
          <NumberField
            label="HSPF"
            value={draft.hspf}
            step={0.01}
            onChange={(hspf) => setDraft({ ...draft, hspf })}
            disabled={readOnly}
          />
        </RowEditGrid>
      </RowEditSection>
      <TextAreaField
        label="Notes"
        value={draft.notes ?? ""}
        onChange={(notes) => setDraft({ ...draft, notes })}
        disabled={readOnly}
      />
    </RowEditModal>
  );
}

function negativeNumber(
  value: number | null,
  { strictlyPositive = false }: { strictlyPositive?: boolean } = {},
): boolean {
  if (value === null) return false;
  return strictlyPositive ? value <= 0 : value < 0;
}
