import type { ReactNode } from "react";
import { DialogActions } from "../../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import {
  CONSTRUCTION_ACTION_LABELS,
  MATERIAL_DECISION_LABELS,
  importWarningLabel,
} from "../../import-labels";
import type { ImportConstructionsPreview } from "../../types";

/**
 * Preview → confirm modal for "Upload constructions HBJSON". Shows the dry-run
 * plan (what lands, what is reused/created, any caveats) before the user
 * commits the import to the draft. Per-item overrides arrive in a later phase;
 * v1 confirms the backend's default resolutions.
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
  onConfirm: () => void;
}) {
  const { counts, constructions, materials, warnings } = plan;
  const landingCount = counts.constructions_add + counts.constructions_replace;

  return (
    <ModalDialog
      title="Import constructions"
      titleId="envelope-import-dialog-title"
      onClose={onClose}
    >
      <div className="modal-form envelope-import">
        <div className="envelope-import__chips">
          <CountChip label="Add" value={counts.constructions_add} />
          <CountChip label="Replace" value={counts.constructions_replace} />
          {counts.constructions_skip > 0 ? (
            <CountChip label="Skip" value={counts.constructions_skip} />
          ) : null}
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
          {constructions.map((item, index) => (
            <li
              key={`${item.source_assembly_id ?? "new"}-${index}`}
              className="envelope-import__row"
            >
              <span className="envelope-import__name">{item.name}</span>
              <span className="chip chip--sm chip--outline">
                {CONSTRUCTION_ACTION_LABELS[item.action]}
              </span>
              <RowWarnings warnings={item.warnings} />
            </li>
          ))}
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
          onConfirm={onConfirm}
        />
      </div>
    </ModalDialog>
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
