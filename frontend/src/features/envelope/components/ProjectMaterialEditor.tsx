import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  parseConductivityToWmK,
  parseDensityToKgM3,
  parseSpecificHeatToJKgK,
  useUnitPreference,
  type UnitFormatOptions,
  type UnitParseResult,
  type UnitSystem,
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
  comments: string;
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
    comments: material.comments ?? "",
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

function unitOptionsFor(unitSystem: UnitSystem): UnitFormatOptions {
  return {
    unitSystem,
    showUnit: false,
    useGrouping: false,
    empty: "",
  };
}

function convertUnitInput(
  value: string,
  initialValue: string,
  originalValueSi: number | null,
  parser: (input: string, options: UnitFormatOptions) => UnitParseResult,
  formatter: (value: number | null | undefined, options: UnitFormatOptions) => string,
  fromOptions: UnitFormatOptions,
  toOptions: UnitFormatOptions,
): string {
  const valueSi = parseChangedUnitInput(value, initialValue, originalValueSi, parser, fromOptions);
  return Number.isNaN(valueSi) ? value : formatter(valueSi, toOptions);
}

function convertFormUnitSystem(
  form: MaterialFormState,
  material: ProjectMaterial,
  fromUnitSystem: UnitSystem,
  toUnitSystem: UnitSystem,
): MaterialFormState {
  if (fromUnitSystem === toUnitSystem) return form;
  const fromOptions = unitOptionsFor(fromUnitSystem);
  const toOptions = unitOptionsFor(toUnitSystem);
  const initialForm = formFromMaterial(material, fromOptions);
  return {
    ...form,
    conductivity_w_mk: convertUnitInput(
      form.conductivity_w_mk,
      initialForm.conductivity_w_mk,
      material.conductivity_w_mk,
      parseConductivityToWmK,
      formatConductivityFromWmK,
      fromOptions,
      toOptions,
    ),
    density_kg_m3: convertUnitInput(
      form.density_kg_m3,
      initialForm.density_kg_m3,
      material.density_kg_m3,
      parseDensityToKgM3,
      formatDensityFromKgM3,
      fromOptions,
      toOptions,
    ),
    specific_heat_j_kgk: convertUnitInput(
      form.specific_heat_j_kgk,
      initialForm.specific_heat_j_kgk,
      material.specific_heat_j_kgk,
      parseSpecificHeatToJKgK,
      formatSpecificHeatFromJKgK,
      fromOptions,
      toOptions,
    ),
  };
}

function parseChangedUnitInput(
  value: string,
  initialValue: string,
  originalValueSi: number | null,
  parser: (input: string, options: UnitFormatOptions) => UnitParseResult,
  unitOptions: UnitFormatOptions,
): number | null {
  return value === initialValue
    ? originalValueSi
    : parseOptionalUnitNumber(value, parser, unitOptions);
}

function parseChangedNumberInput(
  value: string,
  initialValue: string,
  originalValue: number | null,
): number | null {
  return value === initialValue ? originalValue : parseOptionalNumber(value);
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
  const [editorUnitSystem, setEditorUnitSystem] = useState(unitSystem);
  const editorUnitSystemRef = useRef(editorUnitSystem);
  const unitOptions = useMemo<UnitFormatOptions>(
    () => unitOptionsFor(editorUnitSystem),
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
    setForm(formFromMaterial(material, unitOptionsFor(editorUnitSystemRef.current)));
    setParseError(null);
  }, [material]);

  useEffect(() => {
    editorUnitSystemRef.current = editorUnitSystem;
  }, [editorUnitSystem]);

  useEffect(() => {
    if (unitSystem === editorUnitSystem) return;
    setForm((current) => convertFormUnitSystem(current, material, editorUnitSystem, unitSystem));
    setEditorUnitSystem(unitSystem);
    setParseError(null);
  }, [editorUnitSystem, material, unitSystem]);

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
    const conductivityWmK = parseChangedUnitInput(
      form.conductivity_w_mk,
      initialForm.conductivity_w_mk,
      material.conductivity_w_mk,
      parseConductivityToWmK,
      unitOptions,
    );
    const densityKgM3 = parseChangedUnitInput(
      form.density_kg_m3,
      initialForm.density_kg_m3,
      material.density_kg_m3,
      parseDensityToKgM3,
      unitOptions,
    );
    const specificHeatJKgK = parseChangedUnitInput(
      form.specific_heat_j_kgk,
      initialForm.specific_heat_j_kgk,
      material.specific_heat_j_kgk,
      parseSpecificHeatToJKgK,
      unitOptions,
    );
    const emissivity = parseChangedNumberInput(
      form.emissivity,
      initialForm.emissivity,
      material.emissivity,
    );
    onCommand({
      kind: "update_project_material",
      project_material_id: material.id,
      name: form.name.trim(),
      category: form.category.trim() || "Other",
      conductivity_w_mk: conductivityWmK,
      density_kg_m3: densityKgM3,
      specific_heat_j_kgk: specificHeatJKgK,
      emissivity,
      ...(showNotes ? { comments: trimToNull(form.comments) } : {}),
    });
  }

  const content = (
    <>
      <header className="project-material-editor__header">
        <p className="shared-material-warning">
          Editing applies to all {material.use_sites.length}{" "}
          {material.use_sites.length === 1 ? "segment" : "segments"} using this material in this
          project, but does not affect the shared <em>Catalog</em> material.
        </p>
        <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
      </header>

      <fieldset className="project-material-editor__group">
        <legend>Identity</legend>
        <div className="project-material-editor__grid">
          <label className="project-material-editor__field project-material-editor__field--full">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.currentTarget.value)}
            />
          </label>
          <label className="project-material-editor__field project-material-editor__field--full">
            <span>Category</span>
            <input
              value={form.category}
              onChange={(event) => updateForm("category", event.currentTarget.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="project-material-editor__group">
        <legend>Thermal properties</legend>
        <div className="project-material-editor__grid">
          <label className="project-material-editor__field">
            <span>
              Lambda
              <small>{conductivityUnitLabel(editorUnitSystem)}</small>
            </span>
            <input
              value={form.conductivity_w_mk}
              onChange={(event) => updateForm("conductivity_w_mk", event.currentTarget.value)}
            />
          </label>
          <label className="project-material-editor__field">
            <span>
              Density
              <small>{densityUnitLabel(editorUnitSystem)}</small>
            </span>
            <input
              value={form.density_kg_m3}
              onChange={(event) => updateForm("density_kg_m3", event.currentTarget.value)}
            />
          </label>
          <label className="project-material-editor__field">
            <span>
              Specific heat
              <small>{specificHeatUnitLabel(editorUnitSystem)}</small>
            </span>
            <input
              value={form.specific_heat_j_kgk}
              onChange={(event) => updateForm("specific_heat_j_kgk", event.currentTarget.value)}
            />
          </label>
          <label className="project-material-editor__field">
            <span>Emissivity</span>
            <input
              value={form.emissivity}
              onChange={(event) => updateForm("emissivity", event.currentTarget.value)}
            />
          </label>
        </div>
      </fieldset>

      {showNotes ? (
        <fieldset className="project-material-editor__group">
          <legend>Notes</legend>
          <label className="project-material-editor__field project-material-editor__field--full">
            <span>Comments</span>
            <textarea
              value={form.comments}
              onChange={(event) => updateForm("comments", event.currentTarget.value)}
            />
          </label>
        </fieldset>
      ) : null}

      <footer className="project-material-editor__footer">
        {parseError || error ? (
          <p className="form-error" role="alert">
            {parseError ?? error}
          </p>
        ) : (
          <span />
        )}
        <button type="submit" disabled={!canSubmit}>
          Update material
        </button>
      </footer>
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
