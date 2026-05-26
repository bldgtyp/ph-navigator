import type { DataTableColumnDef, FieldDef, IdentifierConfig } from "../../types";
import { IDENTIFIER_COLUMN_ID, IDENTIFIER_HEADER_LABEL } from "../../types";
import { formatClipboardValue } from "../paste/tsv";

// Plan 30 — pinned identifier column resolution. Two shapes
// (`kind: "field"` promotes an existing column; `kind: "computed"`
// synthesizes one) and a "broken" branch for `kind: "field"` when the
// backing field is missing (per D9 — graceful ERROR rendering, not a
// silent disappear).
//
// The resolution is consumed in three places:
//   - DataTable transforms its `columnDefs` / `fieldDefs` arrays before
//     handing them to the rest of the pipeline.
//   - GridHeader surfaces the broken-field warning glyph.
//   - GridBody renders the duplicate-value warning chip on cells whose
//     `getValue(row)` collides with another row in the same table.

const ERROR_TOKEN = "ERROR";

export type IdentifierResolution<TRow> =
  | {
      kind: "off";
      columnId: null;
      broken: false;
    }
  | {
      kind: "field";
      columnId: string;
      fieldKey: string;
      broken: false;
      getValue: (row: TRow) => string;
    }
  | {
      // The configured `field` is no longer in the schema. A synthetic
      // ERROR column sits in the leading slot so the grid still
      // functions; the header glyph + cell `ERROR` token surface the
      // problem until the consumer rewires the identifier.
      kind: "field-broken";
      columnId: string;
      fieldKey: string;
      broken: true;
    }
  | {
      kind: "computed";
      columnId: string;
      broken: false;
      getValue: (row: TRow) => string;
    };

export type ApplyIdentifierResult<TRow> = {
  columnDefs: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  resolution: IdentifierResolution<TRow>;
};

// Synthetic FieldDef for the `__record_id__` slot. The field is
// `read_only: true` so the field-editor registry returns `none` (no
// inline edit) and `planFill` silently skips it (matches the paste
// guard's intent in coercePasteWrites). `read_only_schema: true` keeps
// the header context menu from offering rename / type-change / delete.
function syntheticIdentifierFieldDef(): FieldDef {
  return {
    field_key: IDENTIFIER_COLUMN_ID,
    field_type: "text",
    display_name: IDENTIFIER_HEADER_LABEL,
    read_only: true,
    read_only_schema: true,
  };
}

export function applyIdentifierConfig<TRow>({
  identifier,
  columnDefs,
  fieldDefs,
}: {
  identifier: IdentifierConfig<TRow> | undefined;
  columnDefs: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
}): ApplyIdentifierResult<TRow> {
  if (!identifier) {
    return {
      columnDefs,
      fieldDefs,
      resolution: { kind: "off", columnId: null, broken: false },
    };
  }

  if (identifier.kind === "field") {
    const targetIndex = columnDefs.findIndex((column) => column.fieldKey === identifier.field);
    if (targetIndex < 0) {
      const syntheticColumn: DataTableColumnDef<TRow> = {
        id: IDENTIFIER_COLUMN_ID,
        fieldKey: IDENTIFIER_COLUMN_ID,
        header: IDENTIFIER_HEADER_LABEL,
        accessor: () => ERROR_TOKEN,
        render: () => ERROR_TOKEN,
      };
      return {
        columnDefs: [syntheticColumn, ...columnDefs],
        fieldDefs: [syntheticIdentifierFieldDef(), ...fieldDefs],
        resolution: {
          kind: "field-broken",
          columnId: IDENTIFIER_COLUMN_ID,
          fieldKey: identifier.field,
          broken: true,
        },
      };
    }
    const target = columnDefs[targetIndex]!;
    // Promote the backing column to slot 0 with the header label
    // overridden to "Record-ID" (D6). The column id, fieldKey,
    // accessor, and render stay intact so ViewState (columnWidths,
    // sort, filter) round-trips cleanly.
    const promoted: DataTableColumnDef<TRow> = { ...target, header: IDENTIFIER_HEADER_LABEL };
    const rest = columnDefs.filter((_, index) => index !== targetIndex);
    return {
      columnDefs: [promoted, ...rest],
      fieldDefs,
      resolution: {
        kind: "field",
        columnId: promoted.id,
        fieldKey: identifier.field,
        broken: false,
        getValue: (row) => formatClipboardValue(promoted.accessor(row)),
      },
    };
  }

  // kind: "computed"
  const compute = identifier.compute;
  const syntheticColumn: DataTableColumnDef<TRow> = {
    id: IDENTIFIER_COLUMN_ID,
    fieldKey: IDENTIFIER_COLUMN_ID,
    header: IDENTIFIER_HEADER_LABEL,
    accessor: compute,
    render: compute,
  };
  return {
    columnDefs: [syntheticColumn, ...columnDefs],
    fieldDefs: [syntheticIdentifierFieldDef(), ...fieldDefs],
    resolution: {
      kind: "computed",
      columnId: IDENTIFIER_COLUMN_ID,
      broken: false,
      getValue: compute,
    },
  };
}

// Build the set of rowIds whose identifier value collides with another
// row in the same table. Empty / whitespace identifiers do not warn
// (D13). The map value carries the 1-indexed row numbers of the
// *other* conflicting rows so the tooltip can list them.
export function computeIdentifierDuplicates<TRow>({
  resolution,
  rows,
  getRowId,
}: {
  resolution: IdentifierResolution<TRow>;
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
}): Map<string, number[]> {
  if (resolution.kind !== "field" && resolution.kind !== "computed") {
    return new Map();
  }
  const getValue = resolution.getValue;
  const byValue = new Map<string, { rowId: string; rowNumber: number }[]>();
  rows.forEach((row, index) => {
    const value = getValue(row).trim();
    if (value === "") return;
    let bucket = byValue.get(value);
    if (bucket === undefined) {
      bucket = [];
      byValue.set(value, bucket);
    }
    bucket.push({ rowId: getRowId(row), rowNumber: index + 1 });
  });
  const duplicates = new Map<string, number[]>();
  for (const bucket of byValue.values()) {
    if (bucket.length < 2) continue;
    const allRowNumbers = bucket.map((entry) => entry.rowNumber);
    for (const entry of bucket) {
      duplicates.set(
        entry.rowId,
        allRowNumbers.filter((rowNumber) => rowNumber !== entry.rowNumber),
      );
    }
  }
  return duplicates;
}

// Tooltip body for the duplicate warning chip. Caps the explicit row
// numbers at three and appends a "(and X more)" suffix so the tooltip
// stays readable on hot rows.
export function describeDuplicateRows(rowNumbers: readonly number[]): string {
  if (rowNumbers.length === 0) return "";
  if (rowNumbers.length === 1) return `Also used on row ${rowNumbers[0]}.`;
  const explicit = rowNumbers.slice(0, 3).join(", ");
  const remainder = rowNumbers.length - 3;
  const suffix = remainder > 0 ? ` (and ${remainder} more)` : "";
  return `Also used on rows ${explicit}${suffix}.`;
}
