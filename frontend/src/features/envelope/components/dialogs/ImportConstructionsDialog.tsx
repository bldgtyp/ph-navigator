import { useMemo, useState, type ReactNode } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import {
  CONSTRUCTION_ACTION_LABELS,
  MATERIAL_DECISION_LABELS,
  importWarningLabel,
} from "../../import-labels";
import type {
  ConstructionImportAction,
  ConstructionResolution,
  ImportConstructionPlanItem,
  ImportConstructionsPreview,
  ImportMaterialPlanItem,
  MaterialResolution,
} from "../../types";

/**
 * Preview → confirm modal for "Upload constructions HBJSON". Shows the dry-run
 * plan (what lands, what is reused/created, any caveats) and lets the user
 * override each construction's collision action (Add new / Replace / Skip) and
 * reject a material match in favour of a fresh copy, before committing the
 * import to the draft.
 */
export function ImportConstructionsDialog({
  plan,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  plan: ImportConstructionsPreview;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (
    resolutions: ConstructionResolution[],
    materialResolutions: MaterialResolution[],
  ) => void;
}) {
  const { counts, constructions, materials, warnings } = plan;
  // Per-construction action overrides, keyed by `resolution_key` so both native
  // and foreign constructions are addressable.
  const [overrides, setOverrides] = useState<Record<string, ConstructionImportAction>>({});
  // Material source_keys the user forced into a fresh copy (rejecting the match).
  const [forcedNewMaterials, setForcedNewMaterials] = useState<Record<string, boolean>>({});

  const effectiveAction = (item: ImportConstructionPlanItem): ConstructionImportAction =>
    overrides[item.resolution_key] ?? item.action;

  const effectiveDecision = (item: ImportMaterialPlanItem) =>
    forcedNewMaterials[item.source_key] ? "create_new" : item.decision;

  const landingCount = constructions.filter((item) => effectiveAction(item) !== "skip").length;

  const resolutions = useMemo<ConstructionResolution[]>(
    () =>
      constructions.map((item) => ({
        resolution_key: item.resolution_key,
        action: overrides[item.resolution_key] ?? item.action,
        target_assembly_id: item.target_assembly_id,
      })),
    [constructions, overrides],
  );

  const materialResolutions = useMemo<MaterialResolution[]>(
    () =>
      materials
        .filter((item) => forcedNewMaterials[item.source_key] && item.decision !== "create_new")
        .map((item) => ({ source_key: item.source_key, action: "create_new" as const })),
    [materials, forcedNewMaterials],
  );

  return (
    <ModalDialog
      title="Import constructions"
      titleId="envelope-import-dialog-title"
      onClose={onClose}
    >
      <div className="modal-form envelope-import">
        <div className="envelope-import__chips">
          <CountChip label="Landing" value={landingCount} />
          <CountChip label="Reuse materials" value={counts.materials_reused} />
          <CountChip label="From catalog" value={counts.materials_picked_from_catalog} />
          <CountChip label="New materials" value={counts.materials_created} />
        </div>

        {warnings.length > 0 ? (
          <ul className="envelope-import__warnings" aria-label="Import warnings">
            {warnings.map((code) => (
              <li key={code}>{importWarningLabel(code)}</li>
            ))}
          </ul>
        ) : null}

        <ImportSection title="Constructions" count={constructions.length}>
          {constructions.map((item) => (
            <li key={item.resolution_key} className="envelope-import__row">
              <span className="envelope-import__name">{item.name}</span>
              <ActionControl
                item={item}
                value={effectiveAction(item)}
                onChange={(action) =>
                  setOverrides((prev) => ({ ...prev, [item.resolution_key]: action }))
                }
              />
              <RowWarnings warnings={item.warnings} />
            </li>
          ))}
        </ImportSection>

        <ImportSection title="Materials" count={materials.length}>
          {materials.map((item) => (
            <li key={item.source_key} className="envelope-import__row">
              <span className="envelope-import__name">{item.name}</span>
              <span className="chip chip--sm chip--outline">
                {MATERIAL_DECISION_LABELS[effectiveDecision(item)]}
              </span>
              {item.decision !== "create_new" ? (
                <label className="envelope-import__material-override">
                  <input
                    type="checkbox"
                    aria-label={`Create a new copy of ${item.name}`}
                    checked={Boolean(forcedNewMaterials[item.source_key])}
                    onChange={(event) =>
                      setForcedNewMaterials((prev) => ({
                        ...prev,
                        [item.source_key]: event.target.checked,
                      }))
                    }
                  />
                  Create new
                </label>
              ) : null}
              <RowWarnings warnings={item.warnings} />
            </li>
          ))}
        </ImportSection>

        <DialogActions
          busy={busy}
          error={error}
          submitLabel={
            landingCount === 0
              ? "Nothing to import"
              : `Import ${landingCount} construction${landingCount === 1 ? "" : "s"}`
          }
          submitDisabled={landingCount === 0}
          onClose={onClose}
          onConfirm={() => onConfirm(resolutions, materialResolutions)}
        />
      </div>
    </ModalDialog>
  );
}

function ActionControl({
  item,
  value,
  onChange,
}: {
  item: ImportConstructionPlanItem;
  value: ConstructionImportAction;
  onChange: (action: ConstructionImportAction) => void;
}) {
  // Replace is only offered when the file matched an existing assembly; foreign
  // constructions (no target) can be added or skipped.
  const options: ConstructionImportAction[] = item.target_assembly_id
    ? ["replace", "add_new", "skip"]
    : ["add_new", "skip"];
  return (
    <select
      className="envelope-import__action"
      aria-label={`Action for ${item.name}`}
      value={value}
      onChange={(event) => onChange(event.target.value as ConstructionImportAction)}
    >
      {options.map((action) => (
        <option key={action} value={action}>
          {CONSTRUCTION_ACTION_LABELS[action]}
        </option>
      ))}
    </select>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="chip chip--sm chip--outline envelope-import__count">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function ImportSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="envelope-import__section">
      <h3 className="envelope-import__section-title">
        {title} <span className="envelope-import__section-count">({count})</span>
      </h3>
      <ul className="envelope-import__list">{children}</ul>
    </section>
  );
}

function RowWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  const labels = warnings.map(importWarningLabel);
  return (
    <span className="envelope-import__row-warning" title={labels.join("\n")}>
      ⚠ {labels.join(" ")}
    </span>
  );
}
