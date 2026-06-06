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
  const seedKey = entry ? `${entry.element_id}:${entry.target}` : "";

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
    // Re-seed on entry identity change (different field/element); the
    // ``seedKey`` is enough — the ``entry`` ref is intentionally read
    // outside the deps array to avoid re-seeding when only the wrapping
    // object identity changes without a different (element, target).
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
    <div className="refresh-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        className="refresh-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Refresh ${entry.element_name} from catalog`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="refresh-dialog__header">
          <h2>Refresh &lsquo;{entry.element_name}&rsquo; from catalog?</h2>
          <p className="refresh-dialog__subtitle">
            {entry.aperture_type_name} · {entry.target}
          </p>
        </header>
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
        <footer className="refresh-dialog__footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {entry.kind === "field_delta" ? (
            <button
              type="button"
              className="refresh-dialog__save"
              disabled={busy || rows.length === 0}
              onClick={handleSave}
            >
              Save
            </button>
          ) : null}
        </footer>
      </div>
    </div>
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
