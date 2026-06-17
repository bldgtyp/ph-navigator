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
import {
  COOLING_DATA_TYPES,
  HEATING_DATA_TYPES,
  HEAT_PUMP_OPTION_KEYS,
  type CoolingDataType,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpsSlice,
  type HeatingDataType,
} from "../types";

export function OutdoorEquipRowModal({
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
  row: HeatPumpOutdoorEquipRow;
  existingEquip?: HeatPumpOutdoorEquipRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpOutdoorEquipRow) => Promise<void>;
  onDelete?: () => void;
  onCreateOption?: (
    optionKey:
      | typeof HEAT_PUMP_OPTION_KEYS.manufacturer
      | typeof HEAT_PUMP_OPTION_KEYS.systemFamily
      | typeof HEAT_PUMP_OPTION_KEYS.refrigerant,
    label: string,
  ) => Promise<string>;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const title =
    mode === "add" ? "New outdoor equipment" : `Outdoor equipment: ${row.tag || "(unnamed)"}`;
  const manufacturerOptions = options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
  const systemFamilyOptions = options[HEAT_PUMP_OPTION_KEYS.systemFamily] ?? [];
  const refrigerantOptions = options[HEAT_PUMP_OPTION_KEYS.refrigerant] ?? [];

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingEquip, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another outdoor equipment row.`);
      return;
    }
    const trimmedModel = draft.model_number?.trim() || null;
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
        model_number: trimmedModel,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save outdoor equipment."));
      setIsSaving(false);
    }
  };

  return (
    <RowEditModal
      title={title}
      titleId="hp-outdoor-equip-title"
      onCancel={onCancel}
      onSubmit={() => void save()}
      onDelete={onDelete}
      deleteLabel="Delete outdoor equipment"
      error={error}
      isSaving={isSaving}
      readOnly={readOnly}
      submitLabel="Save outdoor equipment"
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
          <TextField
            label="Model number"
            value={draft.model_number ?? ""}
            onChange={(model_number) => setDraft({ ...draft, model_number })}
            disabled={readOnly}
          />
          <ModalSingleSelectField
            label="System family"
            value={draft.system_family}
            options={systemFamilyOptions}
            onChange={(system_family) => setDraft({ ...draft, system_family })}
            onCreate={
              onCreateOption
                ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.systemFamily, label)
                : undefined
            }
            disabled={readOnly}
          />
          <ModalSingleSelectField
            label="Refrigerant"
            value={draft.refrigerant}
            options={refrigerantOptions}
            onChange={(refrigerant) => setDraft({ ...draft, refrigerant })}
            onCreate={
              onCreateOption
                ? (label) => onCreateOption(HEAT_PUMP_OPTION_KEYS.refrigerant, label)
                : undefined
            }
            disabled={readOnly}
          />
        </RowEditGrid>
      </RowEditSection>
      <RowEditSection title="Heating performance">
        {/* Data Type mirrors the Phius calc dropdown and gates which
            efficiency cells the export emits: COPs sends the 17/47F pair,
            HSPF2 sends the seasonal figure. */}
        <RowEditGrid>
          <NumberField
            label="Capacity at 17F (kW)"
            value={draft.heating_cap_kw_17f}
            onChange={(heating_cap_kw_17f) => setDraft({ ...draft, heating_cap_kw_17f })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <NumberField
            label="Capacity at 47F (kW)"
            value={draft.heating_cap_kw_47f}
            onChange={(heating_cap_kw_47f) => setDraft({ ...draft, heating_cap_kw_47f })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <ModalSingleSelectField
            label="Heating Data Type"
            value={draft.heating_data_type}
            options={HEATING_DATA_TYPE_OPTIONS}
            onChange={(heating_data_type) =>
              setDraft({
                ...draft,
                heating_data_type: heating_data_type as HeatingDataType | null,
              })
            }
            disabled={readOnly}
          />
          <NumberField
            label="COP at 17F"
            value={draft.heating_cop_17f}
            onChange={(heating_cop_17f) => setDraft({ ...draft, heating_cop_17f })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <NumberField
            label="COP at 47F"
            value={draft.heating_cop_47f}
            onChange={(heating_cop_47f) => setDraft({ ...draft, heating_cop_47f })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <NumberField
            label="HSPF/HSPF2"
            value={draft.hspf}
            onChange={(hspf) => setDraft({ ...draft, hspf })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
        </RowEditGrid>
      </RowEditSection>
      <RowEditSection title="Cooling performance">
        <RowEditGrid>
          <NumberField
            label="Capacity at 95F (kW)"
            value={draft.cooling_cap_kw_95f}
            onChange={(cooling_cap_kw_95f) => setDraft({ ...draft, cooling_cap_kw_95f })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <ModalSingleSelectField
            label="Cooling Data Type"
            value={draft.cooling_data_type}
            options={COOLING_DATA_TYPE_OPTIONS}
            onChange={(cooling_data_type) =>
              setDraft({
                ...draft,
                cooling_data_type: cooling_data_type as CoolingDataType | null,
              })
            }
            disabled={readOnly}
          />
          <NumberField
            label="EER/EER2"
            value={draft.eer}
            onChange={(eer) => setDraft({ ...draft, eer })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <NumberField
            label="SEER/SEER2"
            value={draft.seer}
            onChange={(seer) => setDraft({ ...draft, seer })}
            disabled={readOnly}
            min={0}
            step={0.01}
          />
          <NumberField
            label="IEER"
            value={draft.ieer}
            onChange={(ieer) => setDraft({ ...draft, ieer })}
            disabled={readOnly}
            min={0}
            step={0.01}
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

const HEATING_DATA_TYPE_OPTIONS = HEATING_DATA_TYPES.map((value) => ({
  id: value,
  label: value,
}));

const COOLING_DATA_TYPE_OPTIONS = COOLING_DATA_TYPES.map((value) => ({
  id: value,
  label: value,
}));
