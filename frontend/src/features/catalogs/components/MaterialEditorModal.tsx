import { type FormEvent, useMemo, useState } from "react";
import {
  parseConductivityToWmK,
  parseDensityToKgM3,
  parseSpecificHeatToJKgK,
  useUnitPreference,
  type UnitFormatOptions,
} from "../../../lib/units";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useCreateMaterialMutation } from "../hooks";
import { MATERIAL_CATEGORY_OPTIONS, materialCategoryFromOptionId } from "../materials/fieldDefs";
import type { CatalogMaterialCreatePayload } from "../types";
import {
  colorToNull,
  editorSubmitLabel,
  parseOptionalNumber,
  parseOptionalUnitNumber,
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
  onClose,
  onSaved,
}: {
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
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [parseError, setParseError] = useState<string | null>(null);
  const createMutation = useCreateMaterialMutation();
  const parsedNumbers = parseMaterialNumbers(form, unitOptions);

  const canSubmit =
    form.name.trim().length > 0 && parsedNumbers !== null && !createMutation.isPending;

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
    createMutation.mutate(payload, { onSuccess: onSaved });
  }

  const errorText =
    parseError ??
    (createMutation.isError
      ? errorMessage(createMutation.error, "Could not create material.")
      : null);

  return (
    <ModalDialog title="New material" titleId="material-editor-title" onClose={onClose}>
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
        <label>
          <span>Category</span>
          <select
            value={form.category}
            onChange={(event) => updateForm("category", event.target.value)}
            required
          >
            {MATERIAL_CATEGORY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
            {editorSubmitLabel(false, createMutation.isPending, "Create material")}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
