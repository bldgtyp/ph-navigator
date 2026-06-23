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
} from "../../types";

/**
 * Preview → confirm modal for "Upload constructions HBJSON". Shows the dry-run
 * plan (what lands, what is reused/created, any caveats) and lets the user
 * override each construction's collision action (Add new / Replace / Skip)
 * before committing the import to the draft. Material decisions are resolved
 * server-side and shown for transparency.
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
  onConfirm: (resolutions: ConstructionResolution[]) => void;
}) {
  const { counts, constructions, materials, warnings } = plan;
  // Per-construction action overrides, keyed by source assembly id. Foreign
  // constructions carry no id and cannot be re-keyed server-side, so they keep
  // their default action.
  const [overrides, setOverrides] = useState<Record<string, ConstructionImportAction>>({});

  const effectiveAction = (item: ImportConstructionPlanItem): ConstructionImportAction =>
    item.source_assembly_id ? (overrides[item.source_assembly_id] ?? item.action) : item.action;

  const landingCount = constructions.filter((item) => effectiveAction(item) !== "skip").length;

  const resolutions = useMemo<ConstructionResolution[]>(
    () =>
      constructions
        .filter((item): item is ImportConstructionPlanItem & { source_assembly_id: string } =>
          Boolean(item.source_assembly_id),
        )
        .map((item) => ({
          source_assembly_id: item.source_assembly_id,
          action: overrides[item.source_assembly_id] ?? item.action,
          target_assembly_id: item.target_assembly_id,
        })),
    [constructions, overrides],
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
          {constructions.map((item, index) => {
            const sourceId = item.source_assembly_id;
            return (
              <li key={`${sourceId ?? "new"}-${index}`} className="envelope-import__row">
                <span className="envelope-import__name">{item.name}</span>
                <ActionControl
                  item={item}
                  value={effectiveAction(item)}
                  onChange={
                    sourceId
                      ? (action) => setOverrides((prev) => ({ ...prev, [sourceId]: action }))
                      : undefined
                  }
                />
                <RowWarnings warnings={item.warnings} />
              </li>
            );
          })}
        </ImportSection>

        <ImportSection title="Materials" count={materials.length}>
          {materials.map((item) => (
            <li key={item.source_key} className="envelope-import__row">
              <span className="envelope-import__name">{item.name}</span>
              <span className="chip chip--sm chip--outline">
                {MATERIAL_DECISION_LABELS[item.decision]}
              </span>
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
          onConfirm={() => onConfirm(resolutions)}
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
  onChange?: (action: ConstructionImportAction) => void;
}) {
  // Foreign constructions (no source id, so no `onChange`) can only be added —
  // show a static chip instead of an editable control.
  if (!onChange) {
    return <span className="chip chip--sm chip--outline">{CONSTRUCTION_ACTION_LABELS[value]}</span>;
  }
  // Replace is only offered when the file matched an existing assembly.
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
