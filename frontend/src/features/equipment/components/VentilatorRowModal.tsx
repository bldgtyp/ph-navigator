import {
  ModalSingleSelectField,
  NumberField,
  RowEditGrid,
  RowEditModal,
  RowEditSection,
  setCustomValue,
  TextField,
  useRowEditForm,
} from "../../../shared/ui/data-table";
import { customNumberValue, customTextValue } from "../lib/customValueReaders";
import {
  VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";

export function VentilatorRowModal({
  row,
  options,
  readOnly,
  onCancel,
  onSubmit,
}: {
  row: VentilatorRow;
  options: VentilatorsSlice["single_select_options"];
  readOnly: boolean;
  onCancel: () => void;
  onSubmit: (row: VentilatorRow) => Promise<void>;
}) {
  const insideOutsideOptions = options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY] ?? [];
  const title = `Ventilator: ${customTextValue(row, "record_id") || "(unnamed)"}`;
  const form = useRowEditForm({
    initialRow: row,
    onSubmit,
    failureMessage: "Could not save ventilator.",
  });
  const { draft, setDraft } = form;
  const updateCustomValue = (fieldKey: string, value: string | number | null) => {
    setDraft((current) => setCustomValue(current, fieldKey, value));
  };

  return (
    <RowEditModal
      title={title}
      titleId="ventilator-row-title"
      onCancel={onCancel}
      onSubmit={() => void form.save()}
      error={form.error}
      isSaving={form.isSaving}
      readOnly={readOnly}
      submitLabel="Save ventilator"
    >
      <RowEditSection title="Identity">
        <RowEditGrid>
          <TextField
            label="Tag"
            value={customTextValue(draft, "record_id")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("record_id", value)}
          />
          <TextField
            label="Name"
            value={customTextValue(draft, "name")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("name", value)}
          />
          <TextField
            label="Manufacturer"
            value={customTextValue(draft, "manufacturer")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("manufacturer", value)}
          />
          <TextField
            label="Model"
            value={customTextValue(draft, "model")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("model", value)}
          />
          <ModalSingleSelectField
            label="Inside / Outside"
            value={draft.inside_outside}
            options={insideOutsideOptions}
            disabled={readOnly}
            placeholder="Unassigned"
            onChange={(inside_outside) => setDraft((current) => ({ ...current, inside_outside }))}
          />
          <TextField
            label="URL"
            value={draft.url ?? ""}
            disabled={readOnly}
            className="table-row-modal-grid__wide"
            onChange={(value) => setDraft({ ...draft, url: value })}
          />
        </RowEditGrid>
      </RowEditSection>
      <RowEditSection title="Performance">
        <RowEditGrid>
          <NumberField
            label="Airflow Rate"
            value={customNumberValue(draft, "airflow_rate_m3h")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("airflow_rate_m3h", value)}
          />
          <NumberField
            label="Heat Recovery %"
            value={customNumberValue(draft, "heat_recovery_percent")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("heat_recovery_percent", value)}
          />
          <NumberField
            label="Moisture Recovery %"
            value={customNumberValue(draft, "moisture_recovery_percent")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("moisture_recovery_percent", value)}
          />
          <NumberField
            label="Electrical Efficiency"
            value={customNumberValue(draft, "electrical_efficiency_wh_m3")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("electrical_efficiency_wh_m3", value)}
          />
          <NumberField
            label="Filter MERV Rating"
            value={customNumberValue(draft, "filter_merv_rating")}
            disabled={readOnly}
            onChange={(value) => updateCustomValue("filter_merv_rating", value)}
          />
        </RowEditGrid>
      </RowEditSection>
      <label>
        Notes
        <textarea
          rows={4}
          value={draft.notes ?? ""}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })}
          disabled={readOnly}
        />
      </label>
    </RowEditModal>
  );
}
