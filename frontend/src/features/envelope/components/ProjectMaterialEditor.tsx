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
import {
  parseOptionalNumber,
  parseOptionalUnitNumber,
  trimToNull,
} from "../../catalogs/components/form-helpers";
import {
  conductivityUnitLabel,
  densityUnitLabel,
  specificHeatUnitLabel,
} from "../../catalogs/components/unit-labels";
import { ModalUnitToggle } from "./ModalUnitToggle";
import type { EnvelopeCommand, ProjectMaterial } from "../types";

type UpdateProjectMaterialCommand = Extract<EnvelopeCommand, { kind: "update_project_material" }>;

type MaterialFormState = {
  name: string;
  category: string;
  conductivity_w_mk: string;
  density_kg_m3: string;
  specific_heat_j_kgk: string;
  emissivity: string;
  notes: string;
};

function formFromMaterial(
  material: ProjectMaterial,
  unitOptions: UnitFormatOptions,
): MaterialFormState {
  return {
    name: material.name,
    category: material.category ?? "Other",
    conductivity_w_mk: formatConductivityFromWmK(material.conductivity_w_mk, unitOptions),
    density_kg_m3: formatDensityFromKgM3(material.density_kg_m3, unitOptions),
    specific_heat_j_kgk: formatSpecificHeatFromJKgK(material.specific_heat_j_kgk, unitOptions),
    emissivity: material.emissivity?.toString() ?? "",
    notes: material.notes ?? "",
  };
}

function hasInvalidNumber(form: MaterialFormState, unitOptions: UnitFormatOptions): boolean {
  return [
    parseOptionalUnitNumber(form.conductivity_w_mk, parseConductivityToWmK, unitOptions),
    parseOptionalUnitNumber(form.density_kg_m3, parseDensityToKgM3, unitOptions),
    parseOptionalUnitNumber(form.specific_heat_j_kgk, parseSpecificHeatToJKgK, unitOptions),
    parseOptionalNumber(form.emissivity),
  ].some((field) => Number.isNaN(field));
}

export function ProjectMaterialEditor({
  material,
  busy,
  error,
  showNotes = true,
  onCommand,
}: {
  material: ProjectMaterial;
  busy: boolean;
  error: string | null;
  showNotes?: boolean;
  onCommand: (command: UpdateProjectMaterialCommand) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const unitOptions = useMemo<UnitFormatOptions>(
    () => ({
      unitSystem: editorUnitSystem,
      showUnit: false,
      empty: "",
    }),
    [editorUnitSystem],
  );
  const [form, setForm] = useState<MaterialFormState>(() =>
    formFromMaterial(material, unitOptions),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const initialForm = formFromMaterial(material, unitOptions);
  const isDirty = (Object.keys(form) as (keyof MaterialFormState)[]).some(
    (field) => form[field] !== initialForm[field],
  );
  const canSubmit =
    form.name.trim().length > 0 &&
    form.category.trim().length > 0 &&
    !hasInvalidNumber(form, unitOptions) &&
    isDirty &&
    !busy;

  useEffect(() => {
    setForm(formFromMaterial(material, unitOptions));
    setParseError(null);
  }, [material, unitOptions]);

  function updateForm(field: keyof MaterialFormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setParseError(null);
  }

  function submitForm(): void {
    if (!canSubmit) {
      if (hasInvalidNumber(form, unitOptions)) {
        setParseError("Enter valid material values.");
      }
      return;
    }
    if (hasInvalidNumber(form, unitOptions)) {
      setParseError("Enter valid material values.");
      return;
    }
    onCommand({
      kind: "update_project_material",
      project_material_id: material.id,
      name: form.name.trim(),
      category: form.category.trim() || "Other",
      conductivity_w_mk: parseOptionalUnitNumber(
        form.conductivity_w_mk,
        parseConductivityToWmK,
        unitOptions,
      ),
      density_kg_m3: parseOptionalUnitNumber(form.density_kg_m3, parseDensityToKgM3, unitOptions),
      specific_heat_j_kgk: parseOptionalUnitNumber(
        form.specific_heat_j_kgk,
        parseSpecificHeatToJKgK,
        unitOptions,
      ),
      emissivity: parseOptionalNumber(form.emissivity),
      ...(showNotes ? { notes: trimToNull(form.notes) } : {}),
    });
  }

  const content = (
    <>
      <p className="shared-material-warning">
        Editing applies to all {material.use_sites.length} segments using this material.
      </p>
      <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
      <label>
        Name
        <input
          value={form.name}
          onChange={(event) => updateForm("name", event.currentTarget.value)}
        />
      </label>
      <label>
        Category
        <input
          value={form.category}
          onChange={(event) => updateForm("category", event.currentTarget.value)}
        />
      </label>
      <label>
        Lambda ({conductivityUnitLabel(editorUnitSystem)})
        <input
          value={form.conductivity_w_mk}
          onChange={(event) => updateForm("conductivity_w_mk", event.currentTarget.value)}
        />
      </label>
      <label>
        Density ({densityUnitLabel(editorUnitSystem)})
        <input
          value={form.density_kg_m3}
          onChange={(event) => updateForm("density_kg_m3", event.currentTarget.value)}
        />
      </label>
      <label>
        Specific heat ({specificHeatUnitLabel(editorUnitSystem)})
        <input
          value={form.specific_heat_j_kgk}
          onChange={(event) => updateForm("specific_heat_j_kgk", event.currentTarget.value)}
        />
      </label>
      <label>
        Emissivity
        <input
          value={form.emissivity}
          onChange={(event) => updateForm("emissivity", event.currentTarget.value)}
        />
      </label>
      {showNotes ? (
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => updateForm("notes", event.currentTarget.value)}
          />
        </label>
      ) : null}
      {parseError || error ? (
        <p className="form-error" role="alert">
          {parseError ?? error}
        </p>
      ) : null}
      <button type="submit" className="secondary-button" disabled={!canSubmit}>
        Update material
      </button>
    </>
  );

  function submit(event: FormEvent): void {
    event.preventDefault();
    submitForm();
  }

  return (
    <form className="project-material-editor" onSubmit={submit}>
      {content}
    </form>
  );
}
