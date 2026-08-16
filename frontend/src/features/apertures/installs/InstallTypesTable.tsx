import { useMemo } from "react";
import {
  DataTable,
  DATA_TABLE_COLUMN_WIDTHS,
  RECORD_ID_FIELD_KEY,
  attachmentColumn,
  identifierColumn,
  type DataTableColumnDef,
  type DataTableProps,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import {
  DATASHEET_ATTACHMENT_CONFIG,
  SITE_PHOTO_ATTACHMENT_CONFIG,
  uniqueAttachmentAssetIds,
} from "../../assets/lib";
import {
  customFieldColumnDefs,
  type CustomFieldTableActions,
} from "../../../shared/ui/data-table/feature";
import { customNumberValue, customTextValue } from "../../equipment/lib/customValueReaders";
import { statusColumn } from "../../equipment/lib/statusColumn";
import { PDF_REPORT_ATTACHMENT_CONFIG } from "./constants";
import { sortedInstallTypes } from "./payloads";
import {
  APERTURE_INSTALL_DATASHEET_FIELD_KEY,
  APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
  APERTURE_INSTALL_PHOTO_FIELD_KEY,
  APERTURE_INSTALL_SOURCE_KEY,
  type InstallTypeRow,
  type InstallTypesSlice,
} from "./types";

export function InstallTypesTable({
  slice,
  tableSchema,
  isEditor,
  projectId,
  view,
  onViewChange,
  onWrite,
  buildEmptyRow,
  generateRowId,
  sessionKey,
  footerAction,
  onResetView,
  focusRowId,
  ...customFieldActions
}: {
  slice: InstallTypesSlice;
  tableSchema: TableSchema;
  isEditor: boolean;
  projectId: string;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onWrite: NonNullable<DataTableProps<InstallTypeRow>["onWrite"]>;
  buildEmptyRow?: DataTableProps<InstallTypeRow>["buildEmptyRow"];
  generateRowId?: DataTableProps<InstallTypeRow>["generateRowId"];
  sessionKey?: DataTableProps<InstallTypeRow>["sessionKey"];
  footerAction?: DataTableProps<InstallTypeRow>["footerAction"];
  onResetView?: DataTableProps<InstallTypeRow>["onResetView"];
  focusRowId?: string | null;
} & CustomFieldTableActions<InstallTypeRow>) {
  const sortedRows = useMemo(
    () => sortedInstallTypes(slice.aperture_install_types),
    [slice.aperture_install_types],
  );
  const attachmentAssetIds = useMemo(
    () =>
      uniqueAttachmentAssetIds(
        sortedRows,
        (row) => row.pdf_report_asset_ids,
        (row) => row.datasheet_asset_ids,
        (row) => row.photo_asset_ids,
      ),
    [sortedRows],
  );
  const attachmentUrls = useAssetUrls(projectId, attachmentAssetIds);
  const attachmentUrlById = useMemo(
    () => new Map((attachmentUrls.data ?? []).map((item) => [item.asset_id, item])),
    [attachmentUrls.data],
  );
  const { fieldDefs, customFields } = tableSchema;
  const fieldDefByKey = useMemo(
    () => new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef])),
    [fieldDefs],
  );
  const customColumns = useMemo<DataTableColumnDef<InstallTypeRow>[]>(
    () => customFieldColumnDefs({ customFields, fieldDefByKey, rowsComputed: slice.rows_computed }),
    [customFields, fieldDefByKey, slice.rows_computed],
  );
  const columns = useMemo<DataTableColumnDef<InstallTypeRow>[]>(
    () => [
      {
        id: RECORD_ID_FIELD_KEY,
        fieldKey: RECORD_ID_FIELD_KEY,
        header: fieldDefByKey.get(RECORD_ID_FIELD_KEY)?.display_name ?? "Tag",
        accessor: (row) => customTextValue(row, RECORD_ID_FIELD_KEY),
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.recordId,
      },
      identifierColumn({
        fieldDefByKey,
        accessor: (row) => customTextValue(row, "name"),
        defaultWidth: 190,
        rowsComputed: slice.rows_computed,
      }),
      {
        id: "psi_w_mk",
        fieldKey: "psi_w_mk",
        header: fieldDefByKey.get("psi_w_mk")?.display_name ?? "Psi-Install",
        accessor: (row) => customNumberValue(row, "psi_w_mk"),
        defaultWidth: 130,
        className: "numeric-cell",
      },
      {
        id: APERTURE_INSTALL_SOURCE_KEY,
        fieldKey: APERTURE_INSTALL_SOURCE_KEY,
        header: fieldDefByKey.get(APERTURE_INSTALL_SOURCE_KEY)?.display_name ?? "Source",
        accessor: (row) => customTextValue(row, APERTURE_INSTALL_SOURCE_KEY) || null,
        defaultWidth: 190,
      },
      attachmentColumn({
        id: APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
        fieldKey: APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
        header: "PDF Report",
        projectId,
        isEditor,
        assetUrlById: attachmentUrlById,
        assetUrlsPending: attachmentUrls.isPending,
        config: PDF_REPORT_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (row) => row.pdf_report_asset_ids,
        getRowId: (row) => row.id,
        onWrite,
        measureLabel: "PDF reports",
      }),
      attachmentColumn({
        id: APERTURE_INSTALL_DATASHEET_FIELD_KEY,
        fieldKey: APERTURE_INSTALL_DATASHEET_FIELD_KEY,
        header:
          fieldDefByKey.get(APERTURE_INSTALL_DATASHEET_FIELD_KEY)?.display_name ?? "Datasheet",
        projectId,
        isEditor,
        assetUrlById: attachmentUrlById,
        assetUrlsPending: attachmentUrls.isPending,
        config: DATASHEET_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (row) => row.datasheet_asset_ids,
        getRowId: (row) => row.id,
        onWrite,
        measureLabel: "datasheets",
      }),
      attachmentColumn({
        id: APERTURE_INSTALL_PHOTO_FIELD_KEY,
        fieldKey: APERTURE_INSTALL_PHOTO_FIELD_KEY,
        header: fieldDefByKey.get(APERTURE_INSTALL_PHOTO_FIELD_KEY)?.display_name ?? "Site photos",
        projectId,
        isEditor,
        assetUrlById: attachmentUrlById,
        assetUrlsPending: attachmentUrls.isPending,
        config: SITE_PHOTO_ATTACHMENT_CONFIG,
        AttachmentCell,
        getAssetIds: (row) => row.photo_asset_ids,
        getRowId: (row) => row.id,
        onWrite,
        measureLabel: "site photos",
      }),
      {
        id: "notes",
        fieldKey: "notes",
        header: fieldDefByKey.get("notes")?.display_name ?? "Notes",
        accessor: (row) => row.notes,
        defaultWidth: DATA_TABLE_COLUMN_WIDTHS.notes,
      },
      statusColumn<InstallTypeRow>(),
      ...customColumns,
    ],
    [
      customColumns,
      fieldDefByKey,
      isEditor,
      onWrite,
      projectId,
      attachmentUrlById,
      attachmentUrls.isPending,
      slice.rows_computed,
    ],
  );

  return (
    <DataTable
      tableName="Installs"
      rows={sortedRows}
      focusRowId={focusRowId}
      columnDefs={columns}
      fieldDefs={fieldDefs}
      getRowId={(row) => row.id}
      emptyMessage={
        isEditor ? "No install types yet." : "No install types are published in this version."
      }
      readOnly={!isEditor}
      view={view}
      onViewChange={onViewChange}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      generateRowId={generateRowId}
      sessionKey={sessionKey}
      footerAction={footerAction}
      onResetView={onResetView}
      {...customFieldActions}
    />
  );
}
