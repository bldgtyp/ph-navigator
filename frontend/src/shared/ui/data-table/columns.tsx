import type { ComponentType, ReactNode } from "react";
import type { DataTableColumnDef, DataTableProps, FieldDef } from "./types";
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

export function identifierColumn<TRow>({
  fieldDefByKey,
  accessor,
  id = "name",
  fieldKey = id,
  fallbackHeader = "Display Name",
  defaultWidth = DATA_TABLE_COLUMN_WIDTHS.identifier,
}: {
  fieldDefByKey: ReadonlyMap<string, FieldDef>;
  accessor: (row: TRow) => unknown;
  id?: string;
  fieldKey?: string;
  fallbackHeader?: string;
  defaultWidth?: number;
}): DataTableColumnDef<TRow> {
  return identifierColumnDef({
    id,
    fieldKey,
    header: fieldDefByKey.get(fieldKey)?.display_name ?? fallbackHeader,
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
        onChange={(next) => {
          if (sameOrderedStrings(getAssetIds(row), next)) return;
          if (onChange) return onChange(row, next);
          if (onWrite && getRowId) {
            return onWrite({
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
