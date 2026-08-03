import { useEffect, useMemo, useState } from "react";
import {
  formatAirPermeanceFromLSM2,
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatSpecificHeatFromJKgK,
  formatVaporMu,
  formatVaporSd,
  parseAirPermeanceToLSM2,
  parseConductivityToWmK,
  parseDensityToKgM3,
  parseSpecificHeatToJKgK,
  parseVaporMu,
  parseVaporSd,
  useUnitPreference,
  type UnitFormatOptions,
} from "../../../lib/units";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import {
  parseOptionalNumber,
  parseOptionalUnitNumber,
  trimToNull,
} from "../../catalogs/components/form-helpers";
import { ModalUnitToggle } from "./ModalUnitToggle";
import { materialCatalogActionHint } from "../drift";
import type {
  EnvelopeCommand,
  ProjectMaterial,
  ProjectMaterialDriftField,
  ProjectMaterialDriftFieldKey,
  ProjectMaterialDriftItem,
  ProjectMaterialRefreshChoice,
} from "../types";

const DRIFT_FIELD_LABELS: Record<ProjectMaterialDriftFieldKey, string> = {
  name: "Name",
  category: "Category",
  density_kg_m3: "Density",
  specific_heat_j_kgk: "Specific heat",
  conductivity_w_mk: "Lambda",
  emissivity: "Emissivity",
  air_permeance_l_s_m2_at_75pa: "Air permeance",
  vapor_diffusion_resistance_mu: "Vapor resistance",
  vapor_sd_equivalent_m: "Vapor sd",
  color: "Color",
  source: "Source",
  url: "URL",
  comments: "Comments",
};

type DriftAction = ProjectMaterialRefreshChoice["action"];

const ACTION_LABELS: Record<DriftAction, string> = {
  keep_mine: "Keep mine",
  take_catalog: "Take catalog",
  use_value: "Edit…",
};

export function MaterialDriftDialog({
  material,
  item,
  busy,
  error,
  onClose,
  onCommand,
}: {
  material: ProjectMaterial;
  item: ProjectMaterialDriftItem;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCommand: (
    command: Extract<EnvelopeCommand, { kind: "refresh_project_material_from_catalog" }>,
  ) => void;
}) {
  const { unitSystem, setUnitSystem } = useUnitPreference();
  const [editorUnitSystem] = useState(unitSystem);
  const unitOptions = useMemo<UnitFormatOptions>(
    () => ({ unitSystem: editorUnitSystem, showUnit: true, empty: "Empty" }),
    [editorUnitSystem],
  );
  const fields = useMemo(
    () => item.fields.filter((field) => field.differs || field.is_overridden),
    [item.fields],
  );
  const [actions, setActions] = useState<Record<string, DriftAction>>(() => defaultActions(fields));
  const [edits, setEdits] = useState<Record<string, string>>(() =>
    defaultEdits(fields, unitOptions),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    setActions(defaultActions(fields));
    setEdits(defaultEdits(fields, unitOptions));
    setParseError(null);
  }, [fields, unitOptions]);

  function submit(): void {
    const choices: ProjectMaterialRefreshChoice[] = [];
    for (const field of fields) {
      const action = actions[field.key] ?? (field.is_overridden ? "keep_mine" : "take_catalog");
      if (action === "use_value") {
        const value = parseEditedValue(field.key, edits[field.key] ?? "", unitOptions);
        if (value === undefined || Number.isNaN(value)) {
          setParseError(`Enter a valid ${fieldLabel(field.key).toLowerCase()}.`);
          return;
        }
        choices.push({ key: field.key, action, value });
      } else {
        choices.push({ key: field.key, action });
      }
    }
    onCommand({
      kind: "refresh_project_material_from_catalog",
      project_material_id: material.id,
      field_choices: choices,
    });
  }

  const blocked = item.state === "source_deactivated" || item.state === "source_missing";
  // The footer names how many values the current choices will actually write,
  // so "Apply" never over-promises when the user keeps their own values.
  const changeCount = fields.filter((field) => {
    const action = actions[field.key];
    if (action === "use_value") return true;
    if (action === "take_catalog") return field.differs;
    return false;
  }).length;
  const submitLabel =
    changeCount === 0
      ? "Apply refresh"
      : `Apply ${changeCount} ${changeCount === 1 ? "change" : "changes"}`;

  return (
    <ModalDialog
      title={`Catalog review — ${material.name}`}
      titleId="material-drift-dialog-title"
      onClose={onClose}
      headerAccessory={<ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />}
    >
      <div className="modal-form">
        {blocked ? (
          <p className="form-error" role="alert">
            {materialCatalogActionHint(item)} Pick a new catalog source for this material, or keep
            it as a project-only material.
          </p>
        ) : fields.length === 0 ? (
          <p className="modal-lede">This material already matches the catalog.</p>
        ) : (
          <>
            <p className="modal-lede">
              {materialCatalogActionHint(item)} Choose what to keep for each.
            </p>
            <div className="material-drift-fields">
              {fields.map((field) => (
                <section key={field.key} className="drift-field">
                  <h3 className="drift-field__label">
                    {fieldLabel(field.key)}
                    {field.is_overridden ? (
                      <span className="drift-field__override">Local override</span>
                    ) : null}
                  </h3>
                  <div className="drift-field__compare">
                    <span className="drift-value">
                      <span className="drift-value__caption">Project</span>
                      <span className="drift-value__value">
                        {formatDriftValue(field.key, field.project_value, unitOptions)}
                      </span>
                    </span>
                    <span className="drift-field__arrow" aria-hidden="true">
                      →
                    </span>
                    <span className={`drift-value${field.differs ? " drift-value--incoming" : ""}`}>
                      <span className="drift-value__caption">Catalog</span>
                      <span className="drift-value__value">
                        {formatDriftValue(field.key, field.catalog_value, unitOptions)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="drift-choice"
                    role="radiogroup"
                    aria-label={`${fieldLabel(field.key)} value to keep`}
                  >
                    {(["keep_mine", "take_catalog", "use_value"] as const).map((action) => (
                      <label key={action} className="drift-choice__option">
                        <input
                          type="radio"
                          name={`drift-${field.key}`}
                          checked={actions[field.key] === action}
                          onChange={() =>
                            setActions((current) => ({ ...current, [field.key]: action }))
                          }
                        />
                        <span>{ACTION_LABELS[action]}</span>
                      </label>
                    ))}
                  </div>
                  {actions[field.key] === "use_value" ? (
                    <input
                      className="drift-field__input"
                      aria-label={`${fieldLabel(field.key)} value`}
                      value={edits[field.key] ?? ""}
                      onChange={(event) => {
                        setParseError(null);
                        setEdits((current) => ({
                          ...current,
                          [field.key]: event.currentTarget.value,
                        }));
                      }}
                    />
                  ) : null}
                </section>
              ))}
            </div>
          </>
        )}
        <DialogActions
          busy={busy}
          error={parseError ?? error}
          submitLabel={submitLabel}
          submitDisabled={blocked || fields.length === 0}
          onClose={onClose}
          onConfirm={submit}
        />
      </div>
    </ModalDialog>
  );
}

function defaultActions(fields: ProjectMaterialDriftField[]): Record<string, DriftAction> {
  return Object.fromEntries(
    fields.map((field) => [field.key, field.is_overridden ? "keep_mine" : "take_catalog"]),
  );
}

function defaultEdits(
  fields: ProjectMaterialDriftField[],
  unitOptions: UnitFormatOptions,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      formatDriftValue(field.key, field.project_value, unitOptions),
    ]),
  );
}

function fieldLabel(key: ProjectMaterialDriftFieldKey): string {
  return DRIFT_FIELD_LABELS[key];
}

function formatDriftValue(
  key: ProjectMaterialDriftFieldKey,
  value: unknown,
  options: UnitFormatOptions,
): string {
  const numeric = typeof value === "number" ? value : null;
  if (key === "conductivity_w_mk") return formatConductivityFromWmK(numeric, options);
  if (key === "density_kg_m3") return formatDensityFromKgM3(numeric, options);
  if (key === "specific_heat_j_kgk") return formatSpecificHeatFromJKgK(numeric, options);
  if (key === "air_permeance_l_s_m2_at_75pa") return formatAirPermeanceFromLSM2(numeric, options);
  if (key === "vapor_diffusion_resistance_mu") return formatVaporMu(numeric, options);
  if (key === "vapor_sd_equivalent_m") return formatVaporSd(numeric, options);
  if (value === null || value === undefined || value === "") return "Empty";
  return String(value);
}

function parseEditedValue(
  key: ProjectMaterialDriftFieldKey,
  raw: string,
  options: UnitFormatOptions,
): unknown | undefined {
  if (key === "conductivity_w_mk") {
    return parseOptionalUnitNumber(raw, parseConductivityToWmK, options);
  }
  if (key === "density_kg_m3") {
    return parseOptionalUnitNumber(raw, parseDensityToKgM3, options);
  }
  if (key === "specific_heat_j_kgk") {
    return parseOptionalUnitNumber(raw, parseSpecificHeatToJKgK, options);
  }
  if (key === "air_permeance_l_s_m2_at_75pa") {
    return parseOptionalUnitNumber(raw, parseAirPermeanceToLSM2, options);
  }
  if (key === "vapor_diffusion_resistance_mu") {
    return parseOptionalUnitNumber(raw, parseVaporMu, options);
  }
  if (key === "vapor_sd_equivalent_m") {
    return parseOptionalUnitNumber(raw, parseVaporSd, options);
  }
  if (key === "emissivity") return parseOptionalNumber(raw);
  return trimToNull(raw);
}
