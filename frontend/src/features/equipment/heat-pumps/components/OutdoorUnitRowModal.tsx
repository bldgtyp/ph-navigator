import { useMemo, useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  ModalLinkedRecordField,
  RowEditGrid,
  RowEditModal,
  RowEditSection,
  TextAreaField,
  TextField,
} from "../../../../shared/ui/data-table";
import { outdoorEquipLabel, tagCollides } from "../lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";

export function OutdoorUnitRowModal({
  mode,
  row,
  outdoorEquip,
  existingUnits,
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateOutdoorEquip,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpOutdoorUnitRow;
  outdoorEquip: HeatPumpOutdoorEquipRow[];
  existingUnits: HeatPumpOutdoorUnitRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpOutdoorUnitRow) => Promise<void>;
  onDelete?: () => void;
  onCreateOutdoorEquip?: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const manufacturerOptions = useMemo(
    () => options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [],
    [options],
  );
  const title = mode === "add" ? "New outdoor unit" : `Outdoor unit: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create outdoor unit" : "Save outdoor unit";
  const outdoorEquipCandidates = useMemo(
    () =>
      outdoorEquip.map((equip) => ({
        rowId: equip.id,
        recordId: outdoorEquipLabel(equip, manufacturerOptions),
      })),
    [manufacturerOptions, outdoorEquip],
  );

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (!draft.outdoor_equip_id) {
      setError("Select an equipment row.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingUnits, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another outdoor unit.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save outdoor unit."));
      setIsSaving(false);
    }
  };

  return (
    <RowEditModal
      title={title}
      titleId="hp-outdoor-unit-title"
      onCancel={onCancel}
      onSubmit={() => void save()}
      onDelete={onDelete}
      deleteLabel="Delete outdoor unit"
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
          <div className="table-row-modal-grid__wide">
            <ModalLinkedRecordField
              label="Outdoor equipment"
              value={draft.outdoor_equip_id}
              candidates={outdoorEquipCandidates}
              disabled={readOnly}
              placeholder="Select an outdoor equipment row..."
              emptyMessage="No outdoor equipment rows yet"
              onChange={(outdoor_equip_id) =>
                setDraft({ ...draft, outdoor_equip_id: outdoor_equip_id ?? "" })
              }
            />
          </div>
          {!readOnly && onCreateOutdoorEquip ? (
            <button
              type="button"
              className="secondary-button hp-inline-action"
              onClick={onCreateOutdoorEquip}
            >
              Create new outdoor equipment
            </button>
          ) : null}
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
