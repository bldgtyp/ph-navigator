import { useEffect, useMemo, useState } from "react";
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
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import {
  parseOptionalNumber,
  parseOptionalUnitNumber,
  trimToNull,
} from "../../catalogs/components/form-helpers";
import { ModalUnitToggle } from "./ModalUnitToggle";
import { MATERIAL_DRIFT_STATE_LABELS } from "../drift";
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
  color: "Color",
  source: "Source",
  url: "URL",
  comments: "Comments",
};

type DriftAction = ProjectMaterialRefreshChoice["action"];

export function MaterialDriftBadge({ item }: { item: ProjectMaterialDriftItem | null }) {
  if (!item || item.state === "in_sync") return null;
  return (
    <span className={`material-drift-badge ${item.state}`}>
      {MATERIAL_DRIFT_STATE_LABELS[item.state]}
    </span>
  );
}

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
  return (
    <ModalDialog
      title={`Refresh ${material.name}`}
      titleId="material-drift-dialog-title"
      onClose={onClose}
    >
      <div className="modal-form">
        <ModalUnitToggle unitSystem={unitSystem} setUnitSystem={setUnitSystem} />
        {blocked ? (
          <p className="form-error" role="alert">
            Source catalog material is unavailable. Pick a new source or detach to custom.
          </p>
        ) : fields.length === 0 ? (
          <p>
            This material has no field differences. Confirm to update the synced catalog version.
          </p>
        ) : (
          <div className="material-drift-fields">
            {fields.map((field) => (
              <fieldset key={field.key} className="material-drift-field">
                <legend>
                  {fieldLabel(field.key)}
                  {field.is_overridden ? <span>Local override</span> : null}
                </legend>
                <dl>
                  <div>
                    <dt>Project</dt>
                    <dd>{formatDriftValue(field.key, field.project_value, unitOptions)}</dd>
                  </div>
                  <div>
                    <dt>Catalog</dt>
                    <dd>{formatDriftValue(field.key, field.catalog_value, unitOptions)}</dd>
                  </div>
                </dl>
                {(["keep_mine", "take_catalog", "use_value"] as const).map((action) => (
                  <label key={action} className="checkbox-row">
                    <input
                      type="radio"
                      name={`drift-${field.key}`}
                      checked={actions[field.key] === action}
                      onChange={() =>
                        setActions((current) => ({ ...current, [field.key]: action }))
                      }
                    />
                    {actionLabel(action)}
                  </label>
                ))}
                {actions[field.key] === "use_value" ? (
                  <input
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
              </fieldset>
            ))}
          </div>
        )}
        {parseError || error ? (
          <p className="form-error" role="alert">
            {parseError ?? error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy || blocked}
            onClick={submit}
          >
            Apply refresh
          </button>
        </div>
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

function actionLabel(action: DriftAction): string {
  if (action === "keep_mine") return "Keep project value";
  if (action === "take_catalog") return "Take catalog value";
  return "Edit value";
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
  if (key === "emissivity") return parseOptionalNumber(raw);
  return trimToNull(raw);
}
