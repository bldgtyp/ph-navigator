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
import type { VentilatorRow } from "../../types";
import { indoorEquipLabel, outdoorUnitLabel, tagCollides, ventilatorLabel } from "../lib";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";

export function IndoorUnitRowModal({
  mode,
  row,
  indoorEquip,
  outdoorUnits,
  ventilators,
  existingUnits,
  options,
  onCancel,
  onSubmit,
  onDelete,
  onCreateIndoorEquip,
  readOnly,
}: {
  mode: "add" | "edit";
  row: HeatPumpIndoorUnitRow;
  indoorEquip: HeatPumpIndoorEquipRow[];
  outdoorUnits: HeatPumpOutdoorUnitRow[];
  ventilators: VentilatorRow[];
  existingUnits: HeatPumpIndoorUnitRow[];
  options: HeatPumpsSlice["single_select_options"];
  onCancel: () => void;
  onSubmit: (row: HeatPumpIndoorUnitRow) => Promise<void>;
  onDelete?: () => void;
  onCreateIndoorEquip?: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(row);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const manufacturerOptions = useMemo(
    () => options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [],
    [options],
  );
  const title = mode === "add" ? "New indoor unit" : `Indoor unit: ${row.tag || "(unnamed)"}`;
  const submitLabel = mode === "add" ? "Create indoor unit" : "Save indoor unit";
  const noOutdoorUnits = outdoorUnits.length === 0;
  const noVentilators = ventilators.length === 0;
  const sortedVentilators = useMemo(
    () => [...ventilators].sort((a, b) => ventilatorLabel(a).localeCompare(ventilatorLabel(b))),
    [ventilators],
  );
  const indoorEquipCandidates = useMemo(
    () =>
      indoorEquip.map((equip) => ({
        rowId: equip.id,
        recordId: indoorEquipLabel(equip, manufacturerOptions),
      })),
    [indoorEquip, manufacturerOptions],
  );
  const outdoorUnitCandidates = useMemo(
    () => outdoorUnits.map((unit) => ({ rowId: unit.id, recordId: outdoorUnitLabel(unit) })),
    [outdoorUnits],
  );
  const ventilatorCandidates = useMemo(
    () => sortedVentilators.map((vent) => ({ rowId: vent.id, recordId: ventilatorLabel(vent) })),
    [sortedVentilators],
  );

  const save = async () => {
    setError(null);
    const trimmedTag = draft.tag.trim();
    if (!trimmedTag) {
      setError("Tag is required.");
      return;
    }
    if (!draft.indoor_equip_id) {
      setError("Select an equipment row.");
      return;
    }
    if (mode === "edit" && tagCollides(trimmedTag, existingUnits, row.id)) {
      setError(`Tag "${trimmedTag}" is already in use by another indoor unit.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({
        ...draft,
        tag: trimmedTag,
      });
    } catch (err) {
      setError(errorMessage(err, "Could not save indoor unit."));
      setIsSaving(false);
    }
  };

  return (
    <RowEditModal
      title={title}
      titleId="hp-indoor-unit-title"
      onCancel={onCancel}
      onSubmit={() => void save()}
      onDelete={onDelete}
      deleteLabel="Delete indoor unit"
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
              label="Indoor equipment"
              value={draft.indoor_equip_id}
              candidates={indoorEquipCandidates}
              disabled={readOnly}
              placeholder="Select an indoor equipment row..."
              emptyMessage="No indoor equipment rows yet"
              onChange={(indoor_equip_id) =>
                setDraft({ ...draft, indoor_equip_id: indoor_equip_id ?? "" })
              }
            />
          </div>
          {!readOnly && onCreateIndoorEquip ? (
            <button
              type="button"
              className="secondary-button hp-inline-action"
              onClick={onCreateIndoorEquip}
            >
              Create new indoor equipment
            </button>
          ) : null}
          <div className="table-row-modal-grid__wide">
            <ModalLinkedRecordField
              label="Outdoor unit"
              value={draft.outdoor_unit_id}
              candidates={outdoorUnitCandidates}
              disabled={readOnly || noOutdoorUnits}
              emptyMessage="No outdoor units yet"
              onChange={(outdoor_unit_id) => setDraft({ ...draft, outdoor_unit_id })}
            />
            {noOutdoorUnits ? (
              <small className="hp-helper-text">
                Add an outdoor unit first in Units — Outdoor.
              </small>
            ) : null}
          </div>
          <div className="table-row-modal-grid__wide">
            <ModalLinkedRecordField
              label="Linked ERV unit"
              value={draft.linked_erv_unit_id}
              candidates={ventilatorCandidates}
              disabled={readOnly || noVentilators}
              emptyMessage="No ERVs yet"
              onChange={(linked_erv_unit_id) => setDraft({ ...draft, linked_erv_unit_id })}
            />
            {noVentilators ? (
              <small className="hp-helper-text">Add an ERV first under Equipment → ERVs.</small>
            ) : null}
          </div>
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
