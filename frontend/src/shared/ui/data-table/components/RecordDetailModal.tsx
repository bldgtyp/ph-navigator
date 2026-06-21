import { useMemo, useState, type ReactNode } from "react";
import type { UnitSystem } from "../../../../lib/units";
import { getFieldEditor } from "../fields/registry";
import { formatDisplayCellValue } from "../lib/rows/format";
import {
  ModalSingleSelectField,
  NumberField,
  RowEditGrid,
  RowEditModal,
  TextAreaField,
  TextField,
} from "../row-edit";
import type { CellWrite, DataTableColumnDef, FieldDef } from "../types";

// Built-in, generic record-detail modal. DataTable opens this whenever a
// row's Expand affordance fires and the consumer has NOT supplied a
// custom `onRowOpen`. It is assembled entirely from the table's own
// `columnDefs` + `fieldDefs`, so EVERY table gets a working expand with
// zero per-table wiring — the affordance can never render as a dead
// decoration again (the iron-law this component exists to uphold).
//
// Editing is restricted to the field types the inline grid can already
// edit safely from a single value (text / number / single_select). Every
// other type (computed, attachment, linked_record, color, lookup, and any
// `read_only` field) renders read-only here; those stay editable in the
// grid itself. Saves are committed through the injected `onCommit`, which
// DataTable wires to the same `dispatchWrite` chokepoint inline edits use,
// so a modal save rides the normal undo/redo history.

export type RecordDetailCommit = (
  writes: CellWrite[],
  inverses: CellWrite[],
) => Promise<void> | void;

export type RecordDetailModalProps<TRow> = {
  row: TRow;
  rowId: string;
  // The table's currently-visible, ordered columns (identifier pinned
  // first). The modal renders one labeled field per column so its content
  // tracks what the user sees in the grid.
  columns: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  // View-only mode: no editors, Save hidden, Close shown. True for
  // read-only tables (viewer / published version) or when the table has
  // no write handler.
  readOnly: boolean;
  unitSystem: UnitSystem;
  onCommit: RecordDetailCommit;
  onClose: () => void;
};

const TITLE_ID = "data-table-record-detail-title";

// A column is editable in the modal only when the shared field registry
// resolves it to a single-value editor. This is the SAME gate the grid's
// inline edit uses (`getFieldEditor`), so "editable here" never diverges
// from "editable in a cell".
function modalEditorKind(
  fieldDef: FieldDef | undefined,
): "text" | "number" | "single_select" | null {
  const kind = getFieldEditor(fieldDef).kind;
  if (kind === "text" || kind === "number" || kind === "single_select") return kind;
  return null;
}

// Normalize "no value" spellings so an untouched field never counts as a
// change. The grid's editors already coerce empty input to null, so the
// only gap to close here is undefined → null.
function normalizeValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

export function RecordDetailModal<TRow>({
  row,
  rowId,
  columns,
  fieldDefByKey,
  readOnly,
  unitSystem,
  onCommit,
  onClose,
}: RecordDetailModalProps<TRow>) {
  // Snapshot the original value of every editable column once, keyed by
  // fieldKey. Drives both the initial draft and the save-time diff.
  const originalByFieldKey = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const column of columns) {
      if (!readOnly && modalEditorKind(fieldDefByKey.get(column.fieldKey))) {
        map.set(column.fieldKey, normalizeValue(column.accessor(row)));
      }
    }
    return map;
  }, [columns, fieldDefByKey, readOnly, row]);

  const [draft, setDraft] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(originalByFieldKey.entries()),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (fieldKey: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [fieldKey]: value }));
    if (error) setError(null);
  };

  const title = useMemo(() => recordTitle(row, columns), [row, columns]);

  const handleSave = async () => {
    const writes: CellWrite[] = [];
    const inverses: CellWrite[] = [];
    for (const [fieldKey, before] of originalByFieldKey.entries()) {
      const after = normalizeValue(draft[fieldKey]);
      if (Object.is(before, after)) continue;
      writes.push({ rowId, fieldKey, value: after });
      inverses.push({ rowId, fieldKey, value: before });
    }
    if (writes.length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onCommit(writes, inverses);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
      setIsSaving(false);
    }
  };

  return (
    <RowEditModal
      title={title}
      titleId={TITLE_ID}
      onCancel={onClose}
      onSubmit={() => void handleSave()}
      error={error}
      isSaving={isSaving}
      readOnly={readOnly}
      submitLabel="Save"
    >
      <RowEditGrid>
        {columns.map((column) => {
          const fieldDef = fieldDefByKey.get(column.fieldKey);
          const label = column.header || fieldDef?.display_name || column.fieldKey;
          const editorKind = readOnly ? null : modalEditorKind(fieldDef);
          if (editorKind === null) {
            return (
              <ReadOnlyField
                key={column.id}
                label={label}
                content={
                  column.render?.(row, { isActive: false }) ??
                  displayText(column.accessor(row), fieldDef, unitSystem)
                }
              />
            );
          }
          const value = draft[column.fieldKey];
          if (editorKind === "number") {
            return (
              <NumberField
                key={column.id}
                label={label}
                value={typeof value === "number" ? value : null}
                onChange={(next) => setField(column.fieldKey, next)}
              />
            );
          }
          if (editorKind === "single_select") {
            return (
              <ModalSingleSelectField
                key={column.id}
                label={label}
                value={typeof value === "string" ? value : null}
                options={fieldDef?.options ?? []}
                onChange={(next) => setField(column.fieldKey, next)}
              />
            );
          }
          const textValue = typeof value === "string" ? value : "";
          if (fieldDef?.custom_field_type === "long_text") {
            return (
              <TextAreaField
                key={column.id}
                label={label}
                value={textValue}
                onChange={(next) => setField(column.fieldKey, next)}
              />
            );
          }
          return (
            <TextField
              key={column.id}
              label={label}
              value={textValue}
              onChange={(next) => setField(column.fieldKey, next)}
            />
          );
        })}
      </RowEditGrid>
    </RowEditModal>
  );
}

function ReadOnlyField({ label, content }: { label: string; content: ReactNode }) {
  return (
    <label className="data-table-record-detail-readonly">
      {label}
      <div className="data-table-record-detail-readonly-value">{content}</div>
    </label>
  );
}

function displayText(
  value: unknown,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem,
): string {
  const text = formatDisplayCellValue(value, fieldDef, unitSystem);
  return text === "" ? "—" : text;
}

// The modal heading uses the table's identifier column (the pinned Display
// Name) so the user sees which record they opened; falls back to a generic
// label when that value is empty.
function recordTitle<TRow>(row: TRow, columns: DataTableColumnDef<TRow>[]): string {
  const identifier = columns.find((column) => column.isIdentifier) ?? columns[0];
  const raw = identifier ? identifier.accessor(row) : null;
  const label = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
  return label === "" ? "Record details" : label;
}
