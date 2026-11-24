// Catalog review dialog for an aperture frame or glazing use-site entry.
// Matches `MaterialDriftDialog` visually: compare cards (Project → Catalog),
// `.modal-lede`, shared `SegmentedControl`, and a count-bearing submit label.
// `catalog_row_missing` opens read-only with an explanation and disabled primary.

import { useEffect, useState } from "react";
import { DialogActions, ModalDialog, SegmentedControl } from "../../../shared/ui";
import { apertureCatalogActionHint, formatDriftTarget } from "../drift";
import type { ApertureDriftEntry, RefFieldDelta } from "../drift-types";

export type RefreshChoice = "catalog" | "yours" | "edit";

export type RefreshDialogProps = {
  open: boolean;
  entry: ApertureDriftEntry | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (chosenValues: Record<string, string | number | null>) => void;
};

type RowState = {
  delta: RefFieldDelta;
  choice: RefreshChoice;
  editValue: string;
};

const CHOICE_LABELS: Record<RefreshChoice, string> = {
  yours: "Keep mine",
  catalog: "Take catalog",
  edit: "Edit…",
};

const FIELD_LABELS: Record<string, string> = {
  manufacturer: "Manufacturer",
  brand: "Brand",
  use: "Use",
  operation: "Operation",
  location: "Location",
  mull_type: "Mull type",
  prefix: "Prefix",
  suffix: "Suffix",
  material: "Material",
  width_mm: "Width (mm)",
  u_value_w_m2k: "U-value (W/m²K)",
  g_value: "SHGC / g-value",
  psi_g_w_mk: "Psi-g (W/mK)",
  psi_install_w_mk: "Psi-install (W/mK)",
  color: "Color",
  source: "Source",
  comments: "Comments",
};

export function RefreshDialog({
  open,
  entry,
  busy = false,
  error = null,
  onClose,
  onSave,
}: RefreshDialogProps) {
  const [rows, setRows] = useState<RowState[]>([]);
  const seedKey = entry
    ? `${entry.element_id}:${entry.target}:${entry.deltas
        .map((d) => `${d.field_key}=${stringify(d.catalog_value)}`)
        .join("|")}`
    : "";

  // Seed row state whenever a new entry is shown. Diverged user-edited fields
  // default to "yours" (Keep mine).
  useEffect(() => {
    if (!entry) return;
    setRows(
      entry.deltas.map((delta) => ({
        delta,
        choice: delta.in_local_overrides ? "yours" : "catalog",
        editValue: stringify(delta.yours_value),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  if (!open || !entry) return null;

  const setChoice = (key: string, choice: RefreshChoice) =>
    setRows((prev) => prev.map((r) => (r.delta.field_key === key ? { ...r, choice } : r)));

  const setEditValue = (key: string, editValue: string) =>
    setRows((prev) => prev.map((r) => (r.delta.field_key === key ? { ...r, editValue } : r)));

  const bulk = (choice: RefreshChoice) => setRows((prev) => prev.map((r) => ({ ...r, choice })));

  const handleSave = () => {
    const chosen: Record<string, string | number | null> = {};
    for (const row of rows) {
      const raw =
        row.choice === "catalog"
          ? row.delta.catalog_value
          : row.choice === "yours"
            ? row.delta.yours_value
            : row.editValue;
      chosen[row.delta.field_key] = coerce(raw);
    }
    onSave(chosen);
  };

  const blocked = entry.kind === "catalog_row_missing";
  const changeCount = rows.filter(
    (row) => row.choice === "catalog" || row.choice === "edit",
  ).length;
  const submitLabel =
    changeCount === 0
      ? "Apply refresh"
      : `Apply ${changeCount} ${changeCount === 1 ? "change" : "changes"}`;

  return (
    <ModalDialog
      title={`Catalog review — ${entry.element_name}`}
      titleId="refresh-dialog-title"
      onClose={onClose}
      resizable
    >
      <div className="modal-form">
        <p className="modal-subtitle">
          {entry.aperture_type_name} · {formatDriftTarget(entry.target)}
        </p>
        {blocked ? (
          <p className="form-error" role="alert">
            The catalog row for this ref has been removed or deactivated. Repick a new catalog
            record for this slot, or keep it as a project-only copy.
          </p>
        ) : rows.length === 0 ? (
          <p className="modal-lede">This slot already matches the catalog.</p>
        ) : (
          <>
            <p className="modal-lede">
              {apertureCatalogActionHint([entry])} Choose what to keep for each.
            </p>
            {rows.length > 1 ? (
              <div className="refresh-dialog__bulk">
                <button type="button" className="secondary-button" onClick={() => bulk("catalog")}>
                  Take all from catalog
                </button>
                <button type="button" className="secondary-button" onClick={() => bulk("yours")}>
                  Keep all mine
                </button>
              </div>
            ) : null}
            <div className="drift-fields">
              {rows.map((row) => {
                const label = fieldLabel(row.delta.field_key);
                return (
                  <section key={row.delta.field_key} className="drift-field">
                    <h3 className="drift-field__label">
                      {label}
                      {row.delta.in_local_overrides ? (
                        <span className="drift-field__override">Local override</span>
                      ) : null}
                    </h3>
                    <div className="drift-field__compare">
                      <span className="drift-value">
                        <span className="drift-value__caption">Project</span>
                        <span className="drift-value__value">
                          {stringify(row.delta.yours_value)}
                        </span>
                      </span>
                      <span className="drift-field__arrow" aria-hidden="true">
                        →
                      </span>
                      <span className="drift-value drift-value--incoming">
                        <span className="drift-value__caption">Catalog</span>
                        <span className="drift-value__value">
                          {stringify(row.delta.catalog_value)}
                        </span>
                      </span>
                    </div>
                    <SegmentedControl
                      value={row.choice}
                      onChange={(choice) => setChoice(row.delta.field_key, choice)}
                      ariaLabel={`${label} value to keep`}
                      options={(["yours", "catalog", "edit"] as const).map((choice) => ({
                        value: choice,
                        label: CHOICE_LABELS[choice],
                      }))}
                      size="xs"
                    />
                    {row.choice === "edit" ? (
                      <input
                        type="text"
                        className="drift-field__input"
                        value={row.editValue}
                        onChange={(event) => setEditValue(row.delta.field_key, event.target.value)}
                        aria-label={`Edit ${label}`}
                      />
                    ) : null}
                  </section>
                );
              })}
            </div>
          </>
        )}
        <DialogActions
          busy={busy}
          error={error}
          submitLabel={submitLabel}
          submitDisabled={blocked || rows.length === 0}
          onClose={onClose}
          onConfirm={handleSave}
        />
      </div>
    </ModalDialog>
  );
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "Empty";
  if (typeof value === "number") return String(value);
  return String(value);
}

function coerce(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (text === "" || text === "Empty" || text === "—") return null;
  const asNum = Number(text);
  if (!Number.isNaN(asNum) && /^-?\d+(\.\d+)?$/.test(text)) return asNum;
  return text;
}
