// Phase 12 — three-column refresh dialog.
//
// Shows ``Field | Catalog | Yours`` with one radio per row to choose
// take-catalog / keep-mine / edit-a-third-value. Bulk actions stamp
// take-catalog or keep-mine across every row. Diverged user-edited
// fields (those listed in ``catalog_origin.local_overrides``, reported
// by the backend as ``in_local_overrides``) default to **Keep mine**
// and carry a ``You edited this`` tag.
//
// Save resolves to a flat ``chosen_values`` map keyed by ``field_key``
// and dispatches the ``refreshRefFromCatalog`` command. The dialog
// keeps no document state — it only emits the command payload.

import { useEffect, useState } from "react";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ApertureDriftEntry, RefFieldDelta } from "../drift-types";

export type RefreshChoice = "catalog" | "yours" | "edit";

export type RefreshDialogProps = {
  open: boolean;
  entry: ApertureDriftEntry | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (chosenValues: Record<string, string | number | null>) => void;
};

type RowState = {
  delta: RefFieldDelta;
  choice: RefreshChoice;
  editValue: string;
};

export function RefreshDialog({ open, entry, busy = false, onClose, onSave }: RefreshDialogProps) {
  const [rows, setRows] = useState<RowState[]>([]);
  // Re-seed when the (element, target) changes OR when the underlying
  // delta set itself changes — a drift-query refetch while the dialog
  // is open updates `entry.deltas` and the dialog needs to refresh.
  // Hashing the field keys + catalog values into the seed key avoids
  // reading `entry` outside the deps without re-seeding on every
  // wrapping-object identity change.
  const seedKey = entry
    ? `${entry.element_id}:${entry.target}:${entry.deltas
        .map((d) => `${d.field_key}=${stringify(d.catalog_value)}`)
        .join("|")}`
    : "";

  // Seed row state whenever a new entry is shown. Diverged user-edited
  // fields default to "yours" per PRD §15.
  useEffect(() => {
    if (!entry) return;
    setRows(
      entry.deltas.map((delta) => ({
        delta,
        choice: delta.in_local_overrides ? "yours" : "catalog",
        editValue: stringify(delta.catalog_value),
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

  return (
    <ModalDialog
      title={`Refresh ‘${entry.element_name}’ from catalog?`}
      titleId="refresh-dialog-title"
      onClose={onClose}
      resizable
    >
      <p className="modal-subtitle">
        {entry.aperture_type_name} · {entry.target}
      </p>
      {entry.kind === "catalog_row_missing" ? (
        <p className="refresh-dialog__missing" role="alert">
          The catalog row for this ref has been removed. Repick from the catalog instead.
        </p>
      ) : (
        <>
          <div className="refresh-dialog__bulk">
            <button type="button" onClick={() => bulk("catalog")}>
              Take all from catalog
            </button>
            <button type="button" onClick={() => bulk("yours")}>
              Keep all mine
            </button>
          </div>
          <table className="refresh-dialog__table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Catalog</th>
                <th>Yours</th>
                <th>Choice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RefreshRow
                  key={row.delta.field_key}
                  row={row}
                  onChoose={(c) => setChoice(row.delta.field_key, c)}
                  onEdit={(v) => setEditValue(row.delta.field_key, v)}
                />
              ))}
            </tbody>
          </table>
        </>
      )}
      {entry.kind === "field_delta" ? (
        <DialogActions
          busy={busy}
          error={null}
          submitLabel="Save"
          onClose={onClose}
          onConfirm={handleSave}
          submitDisabled={rows.length === 0}
        />
      ) : (
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </ModalDialog>
  );
}

function RefreshRow({
  row,
  onChoose,
  onEdit,
}: {
  row: RowState;
  onChoose: (c: RefreshChoice) => void;
  onEdit: (v: string) => void;
}) {
  const { delta, choice, editValue } = row;
  return (
    <tr>
      <td className="refresh-dialog__field-key">
        {delta.field_key}
        {delta.in_local_overrides ? (
          <span className="refresh-dialog__edited-tag">You edited this</span>
        ) : null}
      </td>
      <td>{stringify(delta.catalog_value)}</td>
      <td>{stringify(delta.yours_value)}</td>
      <td>
        <label>
          <input
            type="radio"
            name={`choice-${delta.field_key}`}
            checked={choice === "catalog"}
            onChange={() => onChoose("catalog")}
          />{" "}
          Take catalog
        </label>
        <label>
          <input
            type="radio"
            name={`choice-${delta.field_key}`}
            checked={choice === "yours"}
            onChange={() => onChoose("yours")}
          />{" "}
          Keep mine
        </label>
        <label>
          <input
            type="radio"
            name={`choice-${delta.field_key}`}
            checked={choice === "edit"}
            onChange={() => onChoose("edit")}
          />{" "}
          Edit
        </label>
        {choice === "edit" ? (
          <input
            type="text"
            className="refresh-dialog__edit-input"
            value={editValue}
            onChange={(event) => onEdit(event.target.value)}
            aria-label={`Edit ${delta.field_key}`}
          />
        ) : null}
      </td>
    </tr>
  );
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  return String(value);
}

// Coerce a value back to its wire shape. The server re-validates through
// Pydantic, so heuristic number coercion here is safe — a stray string
// in a numeric field will return a 422 the user can see and correct.
function coerce(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (text === "" || text === "—") return null;
  const asNum = Number(text);
  if (!Number.isNaN(asNum) && /^-?\d+(\.\d+)?$/.test(text)) return asNum;
  return text;
}
