import { useMemo } from "react";
import {
  DataTable,
  RECORD_ID_FIELD_KEY,
  incomingLinkColumn,
  incomingLinkFieldDef,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import {
  SPACE_TYPE_NAME_FIELD_KEY,
  type InverseLinkField,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../types";

const EMPTY_INVERSE_IDS: readonly string[] = [];

export type LinkedRoomResolver = (rowId: string) => { recordId: string | null } | null;

export function SpaceTypesTable({
  spaceTypesSlice,
  tableSchema,
  isEditor,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  overflowMenuActions,
  footerAction,
  onResetView,
  resolveLinkedRoom,
  onInversePillClick,
  ...customFieldActions
}: {
  spaceTypesSlice: SpaceTypesSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<SpaceTypeRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<SpaceTypeRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<SpaceTypeRow>["generateRowId"];
  sessionKey?: DataTableProps<SpaceTypeRow>["sessionKey"];
  overflowMenuActions?: DataTableProps<SpaceTypeRow>["overflowMenuActions"];
  footerAction?: DataTableProps<SpaceTypeRow>["footerAction"];
  onResetView?: DataTableProps<SpaceTypeRow>["onResetView"];
  resolveLinkedRoom: LinkedRoomResolver;
  onInversePillClick?: (field: InverseLinkField, rowId: string) => void;
} & CustomFieldTableActions<SpaceTypeRow>) {
  const { fieldDefs, customFields } = tableSchema;
  const inverseLinkFields = spaceTypesSlice.inverse_link_fields;
  const inverseLinks = spaceTypesSlice.inverse_links;
  const inverseFieldDefs = useMemo<FieldDef[]>(
    () =>
      inverseLinkFields.map((field) => ({
        ...incomingLinkFieldDef({
          fieldKey: inverseFieldKey(field),
          displayName: inverseColumnHeader(field),
          targetTablePath: field.source_table_path,
        }),
      })),
    [inverseLinkFields],
  );
  const dataTableFieldDefs = useMemo(
    () => [...fieldDefs, ...inverseFieldDefs],
    [fieldDefs, inverseFieldDefs],
  );
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<SpaceTypeRow>[]>(
    () =>
      customFieldColumnDefs({
        customFields,
        fieldDefByKey,
        rowsComputed: spaceTypesSlice.rows_computed,
      }),
    [customFields, fieldDefByKey, spaceTypesSlice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<SpaceTypeRow>[]>(() => {
    const baseColumns: DataTableColumnDef<SpaceTypeRow>[] = [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (spaceType) => textValue(spaceType, RECORD_ID_FIELD_KEY),
        defaultWidth: 140,
      },
      {
        id: SPACE_TYPE_NAME_FIELD_KEY,
        fieldKey: SPACE_TYPE_NAME_FIELD_KEY,
        header: fieldDefByKey.get(SPACE_TYPE_NAME_FIELD_KEY)?.display_name ?? "Display Name",
        accessor: (spaceType) => textValue(spaceType, SPACE_TYPE_NAME_FIELD_KEY),
        defaultWidth: 260,
        isIdentifier: true,
      },
    ];
    const inverseColumns: DataTableColumnDef<SpaceTypeRow>[] = inverseLinkFields.map((field) =>
      incomingLinkColumn({
        id: inverseFieldKey(field),
        fieldKey: inverseFieldKey(field),
        header: inverseColumnHeader(field),
        getIncomingIds: (spaceType) => inverseIdsForSpaceType(inverseLinks, spaceType.id, field),
        resolveLabel: (rowId) => resolveLinkedRoom(rowId)?.recordId ?? null,
        onPillClick: (rowId) => onInversePillClick?.(field, rowId),
        className: "data-table-inverse-link-cell",
        defaultWidth: 220,
      }),
    );
    return [...baseColumns, ...customColumns, ...inverseColumns];
  }, [
    customColumns,
    fieldDefByKey,
    inverseLinkFields,
    inverseLinks,
    onInversePillClick,
    resolveLinkedRoom,
  ]);

  return (
    <DataTable
      rows={spaceTypesSlice.space_types}
      columnDefs={columns}
      fieldDefs={dataTableFieldDefs}
      getRowId={(spaceType) => spaceType.id}
      emptyMessage={
        isEditor ? "No Space-Types yet." : "No Space-Types are published in this version."
      }
      readOnly={!isEditor}
      view={view}
      onViewChange={onViewChange}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      generateRowId={generateRowId}
      sessionKey={sessionKey}
      overflowMenuActions={overflowMenuActions}
      footerAction={footerAction}
      onResetView={onResetView}
      {...customFieldActions}
    />
  );
}

function inverseFieldKey(field: InverseLinkField): string {
  return `inverse:${field.source_key}`;
}

function inverseColumnHeader(field: InverseLinkField): string {
  return `${field.source_table_display} ← ${field.source_field_display_name}`;
}

function inverseIdsForSpaceType(
  inverseLinks: SpaceTypesSlice["inverse_links"],
  spaceTypeId: string,
  field: InverseLinkField,
): readonly string[] {
  return inverseLinks?.[spaceTypeId]?.[field.source_key] ?? EMPTY_INVERSE_IDS;
}

function textValue(row: SpaceTypeRow, fieldKey: string): string {
  const value = row.custom_values?.[fieldKey];
  return typeof value === "string" ? value : "";
}
