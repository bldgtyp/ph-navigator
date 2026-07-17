import type { ComponentType, ReactNode } from "react";
import type { DataTableColumnDef, DataTableProps, FieldDef } from "./types";
import { computedFieldColumnDef, type CustomFieldRow } from "./feature/customFieldColumns";
import { sameOrderedStrings } from "../../lib/arrays";

export const DATA_TABLE_COLUMN_WIDTHS = {
  recordId: 100,
  identifier: 180,
  link: 180,
  attachment: 260,
  notes: 280,
  smallNumeric: 90,
  compactNumeric: 100,
  mediumNumeric: 120,
} as const;

export function shortenUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

export function LinkCell({ value }: { value: string | null | undefined }): ReactNode {
  return value ? (
    <a href={value} target="_blank" rel="noopener noreferrer" className="data-table-link-cell">
      {shortenUrl(value)}
    </a>
  ) : null;
}

export function linkColumn<TRow>({
  id,
  fieldKey = id,
  header,
  getValue,
  defaultWidth = DATA_TABLE_COLUMN_WIDTHS.link,
}: {
  id: string;
  fieldKey?: string;
  header: string;
  getValue: (row: TRow) => string | null | undefined;
  defaultWidth?: number;
}): DataTableColumnDef<TRow> {
  return {
    id,
    fieldKey,
    header,
    accessor: getValue,
    render: (row) => {
      const value = getValue(row);
      return value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="data-table-link-cell">
          {shortenUrl(value)}
        </a>
      ) : null;
    },
    measureText: (row) => getValue(row) ?? "",
    defaultWidth,
  };
}

export function identifierColumn<TRow extends CustomFieldRow>({
  fieldDefByKey,
  accessor,
  id = "name",
  fieldKey = id,
  fallbackHeader = "Display Name",
  defaultWidth = DATA_TABLE_COLUMN_WIDTHS.identifier,
  rowsComputed,
}: {
  fieldDefByKey: ReadonlyMap<string, FieldDef>;
  accessor: (row: TRow) => unknown;
  id?: string;
  fieldKey?: string;
  fallbackHeader?: string;
  defaultWidth?: number;
  // The precomputed formula overlay (`slice.rows_computed`). Pass it so a
  // Display Name set to a Formula renders: the value then comes from the
  // overlay, not the stored string (which is empty for a formula field).
  rowsComputed?: Record<string, Record<string, unknown>>;
}): DataTableColumnDef<TRow> {
  const fieldDef = fieldDefByKey.get(fieldKey);
  const header = fieldDef?.display_name ?? fallbackHeader;
  // When the Display Name field is a formula it renders as a "computed"
  // field type: read it from the precomputed overlay uniformly — the same
  // path Rooms uses for its {Number} — {Name} identifier — so every table
  // gets a formula Display Name for free rather than wiring it by hand.
  if (fieldDef?.field_type === "computed") {
    return identifierColumnDef(
      computedFieldColumnDef<TRow>({
        fieldKey,
        header,
        computedType: fieldDef.computed_type ?? "text",
        rowsComputed,
        defaultWidth,
      }),
    );
  }
  return identifierColumnDef({
    id,
    fieldKey,
    header,
    accessor,
    defaultWidth,
  });
}

export function identifierColumnDef<TRow>(
  column: DataTableColumnDef<TRow>,
  defaultWidth = DATA_TABLE_COLUMN_WIDTHS.identifier,
): DataTableColumnDef<TRow> {
  return {
    ...column,
    defaultWidth: column.defaultWidth ?? defaultWidth,
    isIdentifier: true,
  };
}

type AttachmentCellProps<TConfig, TAssetUrl> = {
  projectId: string;
  value: string[];
  config: TConfig;
  readOnly: boolean;
  onChange: (next: string[]) => Promise<void> | void;
  assetUrlById?: ReadonlyMap<string, TAssetUrl>;
};

export function attachmentColumn<TRow, TConfig, TAssetUrl>({
  id,
  fieldKey = id,
  header,
  projectId,
  isEditor,
  assetUrlById,
  config,
  AttachmentCell,
  getAssetIds,
  getRowId,
  onChange,
  onWrite,
  measureLabel = "attachments",
  defaultWidth = DATA_TABLE_COLUMN_WIDTHS.attachment,
}: {
  id: string;
  fieldKey?: string;
  header: string;
  projectId: string;
  isEditor: boolean;
  assetUrlById: ReadonlyMap<string, TAssetUrl>;
  config: TConfig;
  AttachmentCell: ComponentType<AttachmentCellProps<TConfig, TAssetUrl>>;
  getAssetIds: (row: TRow) => string[];
  getRowId?: (row: TRow) => string;
  onChange?: (row: TRow, next: string[]) => Promise<void> | void;
  onWrite?: NonNullable<DataTableProps<TRow>["onWrite"]>;
  measureLabel?: string;
  defaultWidth?: number;
}): DataTableColumnDef<TRow> {
  return {
    id,
    fieldKey,
    header,
    accessor: (row) => getAssetIds(row).join(","),
    render: (row) => (
      <AttachmentCell
        projectId={projectId}
        value={getAssetIds(row)}
        config={config}
        readOnly={!isEditor}
        assetUrlById={assetUrlById}
        onChange={async (next) => {
          if (sameOrderedStrings(getAssetIds(row), next)) return;
          if (onChange) return onChange(row, next);
          if (onWrite && getRowId) {
            await onWrite({
              kind: "cell",
              writes: [{ rowId: getRowId(row), fieldKey, value: next }],
            });
          }
        }}
      />
    ),
    measureText: (row) => `${getAssetIds(row).length} ${measureLabel}`,
    defaultWidth,
  };
}
