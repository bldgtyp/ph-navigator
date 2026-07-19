import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { attachAssetToDocument, detachAssetFromDocument } from "../assets/api";
import {
  STATUS_FIELD_KEY,
  STATUS_OPTION_COMPLETE,
  STATUS_OPTION_NA,
  STATUS_OPTION_NEEDED,
  STATUS_OPTION_QUESTION,
} from "../equipment/types";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import {
  invalidateProjectDocumentEditorTableSlices,
  type BaseTableSlice,
} from "../project_document/table-slice";
import {
  applyDocumentationEnvelopeCommand,
  fetchDocumentationDraftTable,
  fetchDocumentationSummary,
  replaceDocumentationDraftTable,
} from "./api";
import { documentationQueryKeys } from "./query-keys";
import type {
  DocumentationRecord,
  DocumentationEvidenceStatus,
  DocumentationSpecStatus,
  ProjectDocumentationSummary,
} from "./types";

export function useDocumentationSummaryQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: documentationQueryKeys.summary(projectId, resolvedVersionId, accessMode),
    queryFn: () => fetchDocumentationSummary(projectId, resolvedVersionId, accessMode),
    enabled: resolvedVersionId.length > 0,
    staleTime: Infinity,
  });
}

type DocumentationAttachmentMutation = {
  summary: ProjectDocumentationSummary;
  record: DocumentationRecord;
  nextAssetIds: string[];
};

export type DocumentationFieldChange =
  | {
      record: DocumentationRecord;
      field: "spec_status";
      value: DocumentationSpecStatus;
    }
  | {
      record: DocumentationRecord;
      field: "datasheet_not_required" | "photo_not_required";
      value: boolean;
    }
  | {
      record: DocumentationRecord;
      field: "datasheet_status" | "photo_status";
      value: DocumentationEvidenceStatus;
    };

export type DocumentationFieldMutation = DocumentationFieldChange & {
  summary: ProjectDocumentationSummary;
};

export function useDocumentationPhotoMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: DocumentationAttachmentMutation) => {
      if (!versionId) throw new Error("No active project-document version is selected.");
      return updateDocumentationPhotos(projectId, versionId, change);
    },
    onSuccess: (current) => acknowledgeDocumentationWrite(queryClient, projectId, current),
  });
}

export function useDocumentationFieldMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: DocumentationFieldMutation) => {
      if (!versionId) throw new Error("No active project-document version is selected.");
      return updateDocumentationField(projectId, versionId, change);
    },
    onMutate: async (change) => {
      const queryKey = documentationQueryKeys.summary(
        projectId,
        change.summary.version_id,
        "editor",
      );
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProjectDocumentationSummary>(queryKey);
      queryClient.setQueryData<ProjectDocumentationSummary>(queryKey, (current) =>
        current ? applyOptimisticDocumentationFieldChange(current, change) : current,
      );
      return { previous, queryKey };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(context.queryKey, context.previous);
    },
    onSuccess: (current, change) => {
      const queryKey = documentationQueryKeys.summary(
        projectId,
        change.summary.version_id,
        "editor",
      );
      queryClient.setQueryData<ProjectDocumentationSummary>(queryKey, (cached) =>
        cached ? { ...cached, source: "draft", draft_etag: current.draft_etag } : cached,
      );
      acknowledgeDocumentationWrite(queryClient, projectId, current);
    },
  });
}

function applyOptimisticDocumentationFieldChange(
  summary: ProjectDocumentationSummary,
  change: DocumentationFieldMutation,
): ProjectDocumentationSummary {
  if (change.field === "spec_status") return summary;
  const updateRecord = (record: DocumentationRecord): DocumentationRecord =>
    record.table_key === change.record.table_key && record.record_id === change.record.record_id
      ? { ...record, [change.field]: change.value }
      : record;
  return {
    ...summary,
    sections: summary.sections.map((section) => ({
      ...section,
      records: section.records.map(updateRecord),
      groups: section.groups.map((group) => ({
        ...group,
        records: group.records.map(updateRecord),
      })),
    })),
  };
}

async function updateDocumentationPhotos(
  projectId: string,
  versionId: string,
  { summary, record, nextAssetIds }: DocumentationAttachmentMutation,
): Promise<BaseTableSlice> {
  let current = summaryAsTableSlice(summary);
  const before = new Set(record.photo_asset_ids);
  const after = new Set(nextAssetIds);
  const added = nextAssetIds.filter((assetId) => !before.has(assetId));
  const removed = record.photo_asset_ids.filter((assetId) => !after.has(assetId));
  const rowIds = documentationPhotoTargetRowIds(record);
  const opGroupId = globalThis.crypto?.randomUUID?.() ?? `doc-photo-${Date.now()}`;

  for (const assetId of removed) {
    for (const rowId of rowIds) {
      const response = await detachAssetFromDocument(projectId, assetId, {
        version_id: versionId,
        table_key: record.table_key,
        row_id: rowId,
        field_key: "photo_asset_ids",
        if_match: current.draft_etag,
        if_match_version: current.draft_etag ? null : current.version_etag,
        op_group_id: opGroupId,
      });
      current = acceptedAttachmentSlice(current, response.draft_etag);
    }
  }
  for (const assetId of added) {
    for (const rowId of rowIds) {
      const response = await attachAssetToDocument(projectId, assetId, {
        version_id: versionId,
        table_key: record.table_key,
        row_id: rowId,
        field_key: "photo_asset_ids",
        index: nextAssetIds.indexOf(assetId),
        if_match: current.draft_etag,
        if_match_version: current.draft_etag ? null : current.version_etag,
        op_group_id: opGroupId,
      });
      current = acceptedAttachmentSlice(current, response.draft_etag);
    }
  }
  return current;
}

async function updateDocumentationField(
  projectId: string,
  versionId: string,
  change: DocumentationFieldMutation,
): Promise<BaseTableSlice> {
  if (
    change.record.table_key === "project_glazings" ||
    change.record.table_key === "project_frames"
  ) {
    return updateApertureProductDocumentationField(projectId, versionId, change);
  }
  if (change.record.table_key === "assembly_segments") {
    return updateEnvelopeDocumentationField(projectId, versionId, change);
  }
  return updateTableBackedDocumentationField(projectId, versionId, change);
}

async function updateApertureProductDocumentationField(
  projectId: string,
  versionId: string,
  change: DocumentationFieldMutation,
): Promise<BaseTableSlice> {
  const idKey =
    change.record.table_key === "project_glazings" ? "project_glazing_id" : "project_frame_id";
  const kind =
    change.record.table_key === "project_glazings"
      ? "update_project_glazing"
      : "update_project_frame";
  const fieldValue =
    change.field === "spec_status"
      ? { specification_status: typedSpecificationStatus(change.value) }
      : { [change.field]: change.value };
  const response = await applyDocumentationEnvelopeCommand(
    projectId,
    versionId,
    summaryAsTableSlice(change.summary),
    {
      kind,
      [idKey]: change.record.record_id,
      ...fieldValue,
    },
  );
  return { ...summaryAsTableSlice(change.summary), draft_etag: response.draft_etag };
}

async function updateEnvelopeDocumentationField(
  projectId: string,
  versionId: string,
  change: DocumentationFieldMutation,
): Promise<BaseTableSlice> {
  if (change.field === "photo_not_required") {
    return updateAssemblySegmentPhotoWaiver(projectId, versionId, change.record, change.value);
  }
  if (change.field === "photo_status") {
    return updateAssemblySegmentPhotoStatus(projectId, versionId, change.record, change.value);
  }
  if (!change.record.material_id) {
    throw new Error(`Documentation row ${change.record.record_id} has no project material id.`);
  }
  const fieldValue =
    change.field === "spec_status"
      ? { specification_status: typedSpecificationStatus(change.value) }
      : { [change.field]: change.value };
  const response = await applyDocumentationEnvelopeCommand(
    projectId,
    versionId,
    summaryAsTableSlice(change.summary),
    {
      kind: "update_project_material",
      project_material_id: change.record.material_id,
      ...fieldValue,
    },
  );
  return { ...summaryAsTableSlice(change.summary), draft_etag: response.draft_etag };
}

async function updateAssemblySegmentPhotoWaiver(
  projectId: string,
  versionId: string,
  record: DocumentationRecord,
  value: boolean,
): Promise<BaseTableSlice> {
  return updateAssemblySegmentPhotoField(projectId, versionId, record, "photo_not_required", value);
}

async function updateAssemblySegmentPhotoStatus(
  projectId: string,
  versionId: string,
  record: DocumentationRecord,
  value: DocumentationEvidenceStatus,
): Promise<BaseTableSlice> {
  return updateAssemblySegmentPhotoField(projectId, versionId, record, "photo_status", value);
}

async function updateAssemblySegmentPhotoField(
  projectId: string,
  versionId: string,
  record: DocumentationRecord,
  field: "photo_not_required" | "photo_status",
  value: boolean | DocumentationEvidenceStatus,
): Promise<BaseTableSlice> {
  const current = await fetchDocumentationDraftTable(projectId, versionId, "assembly_segments");
  const targetIds = new Set(record.segment_ids);
  const rows = readRows(current, "rows").filter((row) => targetIds.has(row.id));
  const matchedIds = new Set(rows.map((row) => row.id));
  const missingIds = record.segment_ids.filter((segmentId) => !matchedIds.has(segmentId));
  if (missingIds.length) {
    throw new Error(`Documentation write could not find segments: ${missingIds.join(", ")}.`);
  }
  const hasValue = (row: DocumentationDraftRow) =>
    field === "photo_not_required" ? Boolean(row.photo_not_required) === value : row.photo_status === value;
  if (rows.every(hasValue)) return current;
  const payloadRows = rows.map((row) => ({
    id: row.id,
    photo_asset_ids: Array.isArray(row.photo_asset_ids) ? row.photo_asset_ids : [],
    [field]: value,
    ...(typeof row.use_site_notes === "string" || row.use_site_notes === null
      ? { use_site_notes: row.use_site_notes }
      : {}),
  }));
  return replaceDocumentationDraftTable(projectId, versionId, "assembly_segments", current, {
    rows: payloadRows,
  });
}

async function updateTableBackedDocumentationField(
  projectId: string,
  versionId: string,
  change: DocumentationFieldMutation,
): Promise<BaseTableSlice> {
  const tableName = change.record.table_key;
  const current = await fetchDocumentationDraftTable(projectId, versionId, tableName);
  const rowsKey = documentationRowsKey(tableName);
  const rows = readRows(current, rowsKey);
  const targetRow = rows.find((row) => row.id === change.record.record_id);
  if (!targetRow) {
    throw new Error(
      `Documentation write could not find ${tableName} row ${change.record.record_id}.`,
    );
  }
  if (documentationRowHasValue(targetRow, change)) return current;
  const nextRows = rows.map((row) =>
    row.id === change.record.record_id ? updateDocumentationRow(row, change) : row,
  );
  const payload: Record<string, unknown> = { [rowsKey]: nextRows };
  if (Array.isArray(current.field_defs)) payload.field_defs = current.field_defs;
  if (current.single_select_options && typeof current.single_select_options === "object") {
    payload.single_select_options = current.single_select_options;
  }
  return replaceDocumentationDraftTable(projectId, versionId, tableName, current, payload);
}

function updateDocumentationRow(
  row: DocumentationDraftRow,
  change: DocumentationFieldMutation,
): DocumentationDraftRow {
  if (change.field === "spec_status") {
    return {
      ...row,
      custom_values: {
        ...(isRecord(row.custom_values) ? row.custom_values : {}),
        [STATUS_FIELD_KEY]: customStatusOption(change.value),
      },
    };
  }
  return { ...row, [change.field]: change.value };
}

function acknowledgeDocumentationWrite(
  queryClient: QueryClient,
  projectId: string,
  current: BaseTableSlice,
) {
  markLocalDraftTouched(projectId, current.version_id, current.draft_etag);
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: projectDocumentQueryKeys.draftSummary(projectId, current.version_id),
    }),
    queryClient.invalidateQueries({
      queryKey: documentationQueryKeys.summaries(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: projectDocumentQueryKeys.statusSummaries(projectId),
    }),
    invalidateProjectDocumentEditorTableSlices(queryClient, projectId, current.version_id, {
      refetchActiveSlices: false,
    }),
  ]);
}

function summaryAsTableSlice(summary: ProjectDocumentationSummary): BaseTableSlice {
  return {
    project_id: summary.project_id,
    version_id: summary.version_id,
    source: summary.source,
    version_etag: summary.version_etag,
    draft_etag: summary.draft_etag,
  };
}

function acceptedAttachmentSlice(current: BaseTableSlice, draftEtag: string): BaseTableSlice {
  return { ...current, source: "draft", draft_etag: draftEtag };
}

function documentationPhotoTargetRowIds(record: DocumentationRecord): string[] {
  if (record.table_key === "assembly_segments") {
    if (record.segment_ids.length === 0) {
      throw new Error(`Documentation row ${record.record_id} has no assembly segment ids.`);
    }
    return record.segment_ids;
  }
  return [record.record_id];
}

const ROWS_KEY_BY_TABLE: Record<string, string> = {
  ventilators: "ventilators",
  pumps: "pumps",
  fans: "fans",
  hot_water_heaters: "hot_water_heaters",
  hot_water_tanks: "hot_water_tanks",
  electric_heaters: "electric_heaters",
  appliances: "appliances",
  thermal_bridges: "thermal_bridges",
  project_materials: "rows",
  assembly_segments: "rows",
  heat_pumps_outdoor_equip: "outdoor_equip",
  heat_pumps_indoor_equip: "indoor_equip",
  heat_pumps_outdoor_units: "outdoor_units",
  heat_pumps_indoor_units: "indoor_units",
};

function documentationRowsKey(tableName: string): string {
  const rowsKey = ROWS_KEY_BY_TABLE[tableName];
  if (!rowsKey) {
    throw new Error(`Documentation writes are not configured for table ${tableName}.`);
  }
  return rowsKey;
}

type DocumentationDraftRow = {
  id: string;
  custom_values?: unknown;
  photo_asset_ids?: unknown;
  use_site_notes?: unknown;
  [key: string]: unknown;
};

function readRows(slice: Record<string, unknown>, rowsKey: string): DocumentationDraftRow[] {
  const rows = slice[rowsKey];
  if (!Array.isArray(rows)) {
    throw new Error(`Documentation write could not find rows at ${rowsKey}.`);
  }
  return rows as DocumentationDraftRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function documentationRowHasValue(
  row: DocumentationDraftRow,
  change: DocumentationFieldMutation,
): boolean {
  if (change.field === "spec_status") {
    if (!isRecord(row.custom_values)) return false;
    return row.custom_values[STATUS_FIELD_KEY] === customStatusOption(change.value);
  }
  if (change.field === "datasheet_status" || change.field === "photo_status") {
    return row[change.field] === change.value;
  }
  return Boolean(row[change.field]) === change.value;
}

function typedSpecificationStatus(status: DocumentationSpecStatus) {
  if (status === "needed" || status === "unknown") return "missing";
  return status;
}

function customStatusOption(status: DocumentationSpecStatus): string {
  if (status === "complete") return STATUS_OPTION_COMPLETE;
  if (status === "question") return STATUS_OPTION_QUESTION;
  if (status === "na") return STATUS_OPTION_NA;
  return STATUS_OPTION_NEEDED;
}
