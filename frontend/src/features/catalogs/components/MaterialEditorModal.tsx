import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  parseConductivityToWmK,
  parseDensityToKgM3,
  parseSpecificHeatToJKgK,
  useUnitPreference,
  type UnitFormatOptions,
} from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateMaterialMutation, useUpdateMaterialMutation } from "../hooks";
import { MATERIAL_CATEGORY_OPTIONS, materialCategoryFromOptionId } from "../materials/fieldDefs";
import type { CatalogMaterial, CatalogMaterialCreatePayload } from "../types";
import {
  colorToNull,
  editorSubmitLabel,
  parseOptionalNumber,
  parseOptionalUnitNumber,
  stringOrEmpty,
  trimToNull,
} from "./form-helpers";
import { conductivityUnitLabel, densityUnitLabel, specificHeatUnitLabel } from "./unit-labels";

type FormState = {
  name: string;
  category: string;
  density_kg_m3: string;
  specific_heat_j_kgk: string;
  conductivity_w_mk: string;
  emissivity: string;
  color: string;
  source: string;
  url: string;
  comments: string;
};

type ParsedMaterialNumbers = Pick<
  CatalogMaterialCreatePayload,
  "density_kg_m3" | "specific_heat_j_kgk" | "conductivity_w_mk" | "emissivity"
>;

function emptyForm(): FormState {
  return {
    name: "",
    category: "opt_insulation",
    density_kg_m3: "",
    specific_heat_j_kgk: "",
    conductivity_w_mk: "",
    emissivity: "",
    color: "",
    source: "",
    url: "",
    comments: "",
  };
}

function formFromRecord(record: CatalogMaterial, unitOptions: UnitFormatOptions): FormState {
  return {
    name: record.name,
    category: `opt_${record.category}`,
    density_kg_m3: formatDensityFromKgM3(record.density_kg_m3, unitOptions),
    specific_heat_j_kgk: formatSpecificHeatFromJKgK(record.specific_heat_j_kgk, unitOptions),
    conductivity_w_mk: formatConductivityFromWmK(record.conductivity_w_mk, unitOptions),
    emissivity: record.emissivity === null ? "" : String(record.emissivity),
    color: stringOrEmpty(record.color),
    source: stringOrEmpty(record.source),
    url: stringOrEmpty(record.url),
    comments: stringOrEmpty(record.comments),
  };
}

function parseMaterialNumbers(
  form: FormState,
  unitOptions: UnitFormatOptions,
): ParsedMaterialNumbers | null {
  const values: ParsedMaterialNumbers = {
    density_kg_m3: parseOptionalUnitNumber(form.density_kg_m3, parseDensityToKgM3, unitOptions),
    specific_heat_j_kgk: parseOptionalUnitNumber(
      form.specific_heat_j_kgk,
      parseSpecificHeatToJKgK,
      unitOptions,
    ),
    conductivity_w_mk: parseOptionalUnitNumber(
      form.conductivity_w_mk,
      parseConductivityToWmK,
      unitOptions,
    ),
    emissivity: parseOptionalNumber(form.emissivity),
  };
  return Object.values(values).some((field) => Number.isNaN(field)) ? null : values;
}

function toCreatePayload(
  form: FormState,
  numbers: ParsedMaterialNumbers,
): CatalogMaterialCreatePayload | null {
  const category = materialCategoryFromOptionId(form.category);
  if (category === null) return null;
  return {
    name: form.name.trim(),
    category,
    ...numbers,
    color: colorToNull(form.color),
    source: trimToNull(form.source),
    url: trimToNull(form.url),
    comments: trimToNull(form.comments),
  };
}

export function MaterialEditorModal({
  record,
  onClose,
  onSaved,
}: {
  record: CatalogMaterial | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  // Freeze labels/parsing while the modal is open so a global unit toggle does not rewrite input.
  const [formUnitSystem] = useState(unitSystem);
  const unitOptions = useMemo<UnitFormatOptions>(
    () => ({
      unitSystem: formUnitSystem,
      showUnit: false,
      empty: "",
    }),
    [formUnitSystem],
  );
  const [form, setForm] = useState<FormState>(() =>
    record ? formFromRecord(record, unitOptions) : emptyForm(),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const isEdit = record !== null;
  const createMutation = useCreateMaterialMutation();
  const updateMutation = useUpdateMaterialMutation();
  const activeMutation = isEdit ? updateMutation : createMutation;
  const parsedNumbers = parseMaterialNumbers(form, unitOptions);

  useEffect(() => {
    setForm(record ? formFromRecord(record, unitOptions) : emptyForm());
    setParseError(null);
    // Unit system is intentionally frozen while the modal is open so an
    // in-progress edit is not rewritten under the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const canSubmit =
    form.name.trim().length > 0 && parsedNumbers !== null && !activeMutation.isPending;

  function updateForm(field: keyof FormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setParseError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (parsedNumbers === null) {
      setParseError("Enter valid material values.");
      return;
    }
    if (!canSubmit) return;
    const payload = toCreatePayload(form, parsedNumbers);
    if (payload === null) {
      setParseError("Choose a material category.");
      return;
    }
    if (isEdit && record) {
      updateMutation.mutate({ id: record.id, payload }, { onSuccess: onSaved });
    } else {
      createMutation.mutate(payload, { onSuccess: onSaved });
    }
  }

  const errorText =
    parseError ??
    (activeMutation.isError
      ? errorMessage(
          activeMutation.error,
          isEdit ? "Could not save material." : "Could not create material.",
        )
      : null);

  return (
    <ModalDialog
      title={isEdit ? "Edit material" : "New material"}
      titleId="material-editor-title"
      onClose={onClose}
    >
      <form className="project-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            required
            autoFocus
          />
        </label>
        <AutocompleteSelect
          label="Category"
          value={form.category}
          options={MATERIAL_CATEGORY_OPTIONS.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          onChange={(nextCategory) => updateForm("category", nextCategory)}
        />
        <label>
          <span>Lambda ({conductivityUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.conductivity_w_mk}
            onChange={(event) => updateForm("conductivity_w_mk", event.target.value)}
          />
        </label>
        <label>
          <span>Density ({densityUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.density_kg_m3}
            onChange={(event) => updateForm("density_kg_m3", event.target.value)}
          />
        </label>
        <label>
          <span>Specific heat ({specificHeatUnitLabel(formUnitSystem)})</span>
          <input
            inputMode="decimal"
            value={form.specific_heat_j_kgk}
            onChange={(event) => updateForm("specific_heat_j_kgk", event.target.value)}
          />
        </label>
        <label>
          <span>Emissivity (0-1)</span>
          <input
            inputMode="decimal"
            value={form.emissivity}
            onChange={(event) => updateForm("emissivity", event.target.value)}
          />
        </label>
        <label>
          <span>Color</span>
          <input
            value={form.color}
            onChange={(event) => updateForm("color", event.target.value)}
            placeholder="#rrggbb"
          />
        </label>
        <label>
          <span>Source</span>
          <input
            value={form.source}
            onChange={(event) => updateForm("source", event.target.value)}
          />
        </label>
        <label>
          <span>URL</span>
          <input
            type="url"
            value={form.url}
            onChange={(event) => updateForm("url", event.target.value)}
          />
        </label>
        <label>
          <span>Comments</span>
          <textarea
            rows={3}
            value={form.comments}
            onChange={(event) => updateForm("comments", event.target.value)}
          />
        </label>
        {errorText ? (
          <p className="form-error" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}>
            {editorSubmitLabel(isEdit, activeMutation.isPending, "Create material")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
