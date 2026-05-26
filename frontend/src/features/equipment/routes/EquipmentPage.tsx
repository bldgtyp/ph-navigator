import "../../assets/attachments.css";
import "../equipment.css";
import { useMemo, useState } from "react";
import {
  ALL_FIELD_LOCKS,
  DataTable,
  type DataTableColumnDef,
  DEFAULT_BUILT_IN_LOCKS,
  emptyViewState,
  type FieldDef,
  type ViewState,
} from "../../../shared/ui/data-table";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import type { ProjectDetail } from "../../projects/types";
import { PumpsTableSlot } from "../components/PumpsTableSlot";
import { usePumpsSchemaMutation, usePumpsSliceQuery, useReplacePumpsSliceMutation } from "../hooks";
import {
  PUMPS_SCHEMA_CORE_FIELD_KEYS,
  pumpsTableColumnsForSanitize,
  pumpsTableFieldDefs,
  wasLocalDraftTouched,
} from "../lib";
import { makeBuildEmptyPumpRow } from "../lib/buildEmptyPumpRow";
import { pumpsPayloadBuilders } from "../lib/pumpsController";
import { PUMP_DATASHEET_FIELD_KEY, PUMPS_TABLE_NAME, type PumpsSlice } from "../types";
import { generatedId } from "../../../shared/lib/ids";

const PUMPS_CONFLICT_MESSAGES = {
  activeRowConflict: "The Pumps draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete pump.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

const EQUIPMENT_TABS = [
  { key: "ventilators", label: "Ventilators", emptyMessage: "Ventilators will be built later." },
  { key: "pumps", label: "Pumps", emptyMessage: "No pumps yet." },
  { key: "fans", label: "Fans", emptyMessage: "Fans will be built later." },
  {
    key: "hot-water-tanks",
    label: "Hot-Water Tanks",
    emptyMessage: "Hot-water tanks will be built later.",
  },
  {
    key: "hot-water-heaters",
    label: "Hot Water Heaters",
    emptyMessage: "Hot water heaters will be built later.",
  },
] as const;

type EquipmentTabKey = (typeof EQUIPMENT_TABS)[number]["key"];
type EquipmentTab = (typeof EQUIPMENT_TABS)[number];
type PlaceholderEquipmentTab = Exclude<EquipmentTab, { key: "pumps" }>;
type PlaceholderEquipmentTabKey = PlaceholderEquipmentTab["key"];

type PlaceholderEquipmentRow = {
  id: string;
  name: string;
  datasheet_asset_ids: string[];
};

const PLACEHOLDER_FIELD_DEFS: FieldDef[] = [
  {
    field_key: "name",
    field_type: "text",
    display_name: "Name",
    built_in: true,
    locked: DEFAULT_BUILT_IN_LOCKS,
  },
  {
    field_key: PUMP_DATASHEET_FIELD_KEY,
    field_type: "attachment",
    display_name: "Datasheet",
    built_in: true,
    locked: ALL_FIELD_LOCKS,
  },
];

const PLACEHOLDER_COLUMN_DEFS: DataTableColumnDef<PlaceholderEquipmentRow>[] = [
  {
    id: "name",
    fieldKey: "name",
    header: "Name",
    accessor: (row) => row.name,
    defaultWidth: 220,
  },
  {
    id: PUMP_DATASHEET_FIELD_KEY,
    fieldKey: PUMP_DATASHEET_FIELD_KEY,
    header: "Datasheet",
    accessor: (row) => row.datasheet_asset_ids.join(","),
    defaultWidth: 260,
  },
];

function emptyPlaceholderViews(): Record<PlaceholderEquipmentTabKey, ViewState> {
  return {
    ventilators: emptyViewState(),
    fans: emptyViewState(),
    "hot-water-tanks": emptyViewState(),
    "hot-water-heaters": emptyViewState(),
  };
}

export function EquipmentPage({ project }: { project: ProjectDetail }) {
  const pumpsQuery = usePumpsSliceQuery(project.id, project.active_version_id, project.access_mode);
  if (pumpsQuery.isLoading) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p>Loading pumps...</p>
      </section>
    );
  }
  if (pumpsQuery.isError || !pumpsQuery.data) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p className="form-error" role="alert">
          Could not load Pumps.
        </p>
      </section>
    );
  }
  return (
    <EquipmentPageBody
      project={project}
      pumpsSlice={pumpsQuery.data}
      refetchPumps={pumpsQuery.refetch}
    />
  );
}

function EquipmentPageBody(props: {
  project: ProjectDetail;
  pumpsSlice: PumpsSlice;
  refetchPumps: () => Promise<unknown>;
}) {
  const { project, pumpsSlice, refetchPumps } = props;
  const activeVersionId = project.active_version_id;
  const coreFieldDefs = useMemo(() => pumpsTableFieldDefs(pumpsSlice), [pumpsSlice]);
  const columnsForSanitize = useMemo(
    () => pumpsTableColumnsForSanitize(coreFieldDefs),
    [coreFieldDefs],
  );
  const buildEmptyPumpRow = useMemo(() => makeBuildEmptyPumpRow(), []);
  const replaceMutation = useReplacePumpsSliceMutation(project.id, activeVersionId);
  const schemaMutation = usePumpsSchemaMutation(project.id, activeVersionId);
  const [activeTab, setActiveTab] = useState<EquipmentTabKey>("pumps");
  const [placeholderViews, setPlaceholderViews] = useState(emptyPlaceholderViews);
  const activePlaceholderTab = EQUIPMENT_TABS.find(
    (tab): tab is PlaceholderEquipmentTab => tab.key === activeTab && tab.key !== "pumps",
  );

  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: PUMPS_TABLE_NAME,
    slice: pumpsSlice,
    coreFieldDefs,
    fingerprintCoreFieldKeys: PUMPS_SCHEMA_CORE_FIELD_KEYS,
    customFields: null,
    singleSelectOptions: pumpsSlice.single_select_options,
    columnsForSanitize,
    payloadBuilders: pumpsPayloadBuilders,
    conflictMessages: PUMPS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyPumpRow,
    activeRow: null,
    replaceMutation,
    schemaMutation,
    refetch: refetchPumps,
  });

  const reloadDraft = async () => {
    await controller.reloadDraft();
  };

  const renderActiveEquipmentTable = () => {
    if (activeTab === "pumps") {
      return (
        <PumpsTableSlot
          controller={controller}
          pumpsSlice={pumpsSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyPumpRow}
          footerAction={
            <AddPumpButton
              canEdit={controller.canEdit}
              onAdd={() =>
                void controller.onWrite({
                  kind: "rowInsert",
                  rows: [{ rowId: generatedId("pmp"), fieldDefaults: {}, anchorRowId: null }],
                })
              }
            />
          }
        />
      );
    }
    if (activePlaceholderTab) {
      return (
        <PlaceholderEquipmentTable
          tab={activePlaceholderTab}
          view={placeholderViews[activePlaceholderTab.key]}
          onViewChange={(next) =>
            setPlaceholderViews((current) => {
              if (current[activePlaceholderTab.key] === next) return current;
              return { ...current, [activePlaceholderTab.key]: next };
            })
          }
        />
      );
    }
    return null;
  };

  return (
    <SliceTableShell
      ariaLabel="Equipment"
      className="tab-panel equipment-panel"
      showDraftRestoredBanner={
        pumpsSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, pumpsSlice.draft_etag)
      }
      draftRestoredMessage="Unsaved Pumps draft restored"
      isLocked={controller.isLocked}
      lockedMessage={PUMPS_CONFLICT_MESSAGES.versionLocked}
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <div className="equipment-subtabs" role="tablist" aria-label="Equipment tables">
        {EQUIPMENT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className="equipment-subtab"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {renderActiveEquipmentTable()}
    </SliceTableShell>
  );
}

function PlaceholderEquipmentTable({
  tab,
  view,
  onViewChange,
}: {
  tab: PlaceholderEquipmentTab;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
}) {
  return (
    <DataTable<PlaceholderEquipmentRow>
      rows={[]}
      getRowId={(row) => row.id}
      fieldDefs={PLACEHOLDER_FIELD_DEFS}
      columnDefs={PLACEHOLDER_COLUMN_DEFS}
      view={view}
      onViewChange={onViewChange}
      readOnly
      emptyMessage={tab.emptyMessage}
    />
  );
}

function AddPumpButton({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <button type="button" className="primary-button" disabled={!canEdit} onClick={onAdd}>
      Add pump
    </button>
  );
}
