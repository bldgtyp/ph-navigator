import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSubTabButton, AppSubTabs } from "../../../../shared/ui/AppSubTabs";
import { useSliceTableController } from "../../../../shared/ui/data-table/feature";
import type { DataTableColumnDef } from "../../../../shared/ui/data-table";
import type { ProjectDetail } from "../../../projects/types";
import {
  heatPumpIndoorEquipSliceFeature,
  heatPumpIndoorUnitsSliceFeature,
  heatPumpOutdoorEquipSliceFeature,
  heatPumpOutdoorUnitsSliceFeature,
} from "../api";
import { IndoorEquipTable } from "../components/IndoorEquipTable";
import { IndoorUnitsTable } from "../components/IndoorUnitsTable";
import { OutdoorEquipTable } from "../components/OutdoorEquipTable";
import { OutdoorUnitsTable } from "../components/OutdoorUnitsTable";
import {
  buildEmptyIndoorEquipRow,
  buildEmptyIndoorUnitRow,
  buildEmptyOutdoorEquipRow,
  buildEmptyOutdoorUnitRow,
  heatPumpIndoorEquipPayloadBuilders,
  heatPumpIndoorUnitsPayloadBuilders,
  heatPumpOutdoorEquipPayloadBuilders,
  heatPumpOutdoorUnitsPayloadBuilders,
} from "../lib";
import {
  DEFAULT_HEAT_PUMP_LEAF,
  HEAT_PUMP_LEAF_TABS,
  heatPumpLeafPath,
  leafFromPath,
  readRememberedHeatPumpLeaf,
  rememberHeatPumpLeaf,
  type HeatPumpLeafKey,
} from "./heatPumpLeafTabs";

const HEAT_PUMP_CONFLICT_MESSAGES = {
  activeRowConflict:
    "The Heat Pumps draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete the Heat Pump row.",
  versionLocked: "This project version is locked. Save a new version before editing Heat Pumps.",
};

export function HeatPumpsPanel({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const params = useParams();
  const nestedPath = params["*"] ?? "";
  const requestedLeaf = leafFromPath(nestedPath);
  const outdoorEquipQuery = heatPumpOutdoorEquipSliceFeature.useSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const indoorEquipQuery = heatPumpIndoorEquipSliceFeature.useSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const outdoorUnitsQuery = heatPumpOutdoorUnitsSliceFeature.useSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const indoorUnitsQuery = heatPumpIndoorUnitsSliceFeature.useSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const outdoorEquipMutation = heatPumpOutdoorEquipSliceFeature.useReplaceSliceMutation(
    project.id,
    project.active_version_id,
  );
  const indoorEquipMutation = heatPumpIndoorEquipSliceFeature.useReplaceSliceMutation(
    project.id,
    project.active_version_id,
  );
  const outdoorUnitsMutation = heatPumpOutdoorUnitsSliceFeature.useReplaceSliceMutation(
    project.id,
    project.active_version_id,
  );
  const indoorUnitsMutation = heatPumpIndoorUnitsSliceFeature.useReplaceSliceMutation(
    project.id,
    project.active_version_id,
  );
  const outdoorEquipSchemaMutation = heatPumpOutdoorEquipSliceFeature.useSchemaMutationMutation(
    project.id,
    project.active_version_id,
  );
  const indoorEquipSchemaMutation = heatPumpIndoorEquipSliceFeature.useSchemaMutationMutation(
    project.id,
    project.active_version_id,
  );
  const outdoorUnitsSchemaMutation = heatPumpOutdoorUnitsSliceFeature.useSchemaMutationMutation(
    project.id,
    project.active_version_id,
  );
  const indoorUnitsSchemaMutation = heatPumpIndoorUnitsSliceFeature.useSchemaMutationMutation(
    project.id,
    project.active_version_id,
  );
  const [activeLeaf, setActiveLeaf] = useState<HeatPumpLeafKey>(
    () => requestedLeaf ?? readRememberedHeatPumpLeaf(project.id) ?? DEFAULT_HEAT_PUMP_LEAF,
  );

  useEffect(() => {
    const nextLeaf =
      requestedLeaf ?? readRememberedHeatPumpLeaf(project.id) ?? DEFAULT_HEAT_PUMP_LEAF;
    setActiveLeaf((current) => (current === nextLeaf ? current : nextLeaf));
    if (requestedLeaf) {
      rememberHeatPumpLeaf(project.id, requestedLeaf);
    } else {
      navigate(heatPumpLeafPath(project.id, nextLeaf), { replace: true });
    }
  }, [navigate, project.id, requestedLeaf]);

  const outdoorEquipSlice = outdoorEquipQuery.data;
  const indoorEquipSlice = indoorEquipQuery.data;
  const outdoorUnitsSlice = outdoorUnitsQuery.data;
  const indoorUnitsSlice = indoorUnitsQuery.data;
  const isLoading =
    outdoorEquipQuery.isLoading ||
    indoorEquipQuery.isLoading ||
    outdoorUnitsQuery.isLoading ||
    indoorUnitsQuery.isLoading;
  const isError =
    outdoorEquipQuery.isError ||
    indoorEquipQuery.isError ||
    outdoorUnitsQuery.isError ||
    indoorUnitsQuery.isError;
  const outdoorEquipColumnsForSanitize = useMemo(
    () => sanitizeColumns(outdoorEquipSlice?.field_defs),
    [outdoorEquipSlice?.field_defs],
  );
  const indoorEquipColumnsForSanitize = useMemo(
    () => sanitizeColumns(indoorEquipSlice?.field_defs),
    [indoorEquipSlice?.field_defs],
  );
  const outdoorUnitsColumnsForSanitize = useMemo(
    () => sanitizeColumns(outdoorUnitsSlice?.field_defs),
    [outdoorUnitsSlice?.field_defs],
  );
  const indoorUnitsColumnsForSanitize = useMemo(
    () => sanitizeColumns(indoorUnitsSlice?.field_defs),
    [indoorUnitsSlice?.field_defs],
  );

  const outdoorEquipController = useSliceTableController({
    projectId: project.id,
    activeVersionId: project.active_version_id,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: "heat_pumps_outdoor_equip",
    slice: outdoorEquipSlice ?? EMPTY_OUTDOOR_EQUIP_SLICE,
    fieldDefs: outdoorEquipSlice?.field_defs,
    singleSelectOptions: outdoorEquipSlice?.single_select_options ?? null,
    columnsForSanitize: outdoorEquipColumnsForSanitize,
    payloadBuilders: heatPumpOutdoorEquipPayloadBuilders,
    conflictMessages: HEAT_PUMP_CONFLICT_MESSAGES,
    buildEmptyRow: ({ rowId, fieldDefaults }) =>
      buildEmptyOutdoorEquipRow({ ...fieldDefaults, id: rowId }),
    activeRow: null,
    replaceMutation: outdoorEquipMutation,
    schemaMutation: outdoorEquipSchemaMutation,
    refetch: outdoorEquipQuery.refetch,
  });
  const indoorEquipController = useSliceTableController({
    projectId: project.id,
    activeVersionId: project.active_version_id,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: "heat_pumps_indoor_equip",
    slice: indoorEquipSlice ?? EMPTY_INDOOR_EQUIP_SLICE,
    fieldDefs: indoorEquipSlice?.field_defs,
    singleSelectOptions: indoorEquipSlice?.single_select_options ?? null,
    columnsForSanitize: indoorEquipColumnsForSanitize,
    payloadBuilders: heatPumpIndoorEquipPayloadBuilders,
    conflictMessages: HEAT_PUMP_CONFLICT_MESSAGES,
    buildEmptyRow: ({ rowId, fieldDefaults }) =>
      buildEmptyIndoorEquipRow({ ...fieldDefaults, id: rowId }),
    activeRow: null,
    replaceMutation: indoorEquipMutation,
    schemaMutation: indoorEquipSchemaMutation,
    refetch: indoorEquipQuery.refetch,
    defaultHiddenColumns: [
      "fan_speed_cfm",
      "heating_btuh_17f",
      "heating_cop",
      "seer",
      "eer",
      "hspf",
      "notes",
    ],
  });
  const outdoorUnitsController = useSliceTableController({
    projectId: project.id,
    activeVersionId: project.active_version_id,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: "heat_pumps_outdoor_units",
    slice: outdoorUnitsSlice ?? EMPTY_OUTDOOR_UNITS_SLICE,
    fieldDefs: outdoorUnitsSlice?.field_defs,
    singleSelectOptions: outdoorUnitsSlice?.single_select_options ?? null,
    columnsForSanitize: outdoorUnitsColumnsForSanitize,
    payloadBuilders: heatPumpOutdoorUnitsPayloadBuilders,
    conflictMessages: HEAT_PUMP_CONFLICT_MESSAGES,
    buildEmptyRow: ({ rowId, fieldDefaults }) =>
      buildEmptyOutdoorUnitRow({ ...fieldDefaults, id: rowId }),
    activeRow: null,
    replaceMutation: outdoorUnitsMutation,
    schemaMutation: outdoorUnitsSchemaMutation,
    refetch: outdoorUnitsQuery.refetch,
    defaultHiddenColumns: ["notes"],
  });
  const indoorUnitsController = useSliceTableController({
    projectId: project.id,
    activeVersionId: project.active_version_id,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: "heat_pumps_indoor_units",
    slice: indoorUnitsSlice ?? EMPTY_INDOOR_UNITS_SLICE,
    fieldDefs: indoorUnitsSlice?.field_defs,
    singleSelectOptions: indoorUnitsSlice?.single_select_options ?? null,
    columnsForSanitize: indoorUnitsColumnsForSanitize,
    payloadBuilders: heatPumpIndoorUnitsPayloadBuilders,
    conflictMessages: HEAT_PUMP_CONFLICT_MESSAGES,
    buildEmptyRow: ({ rowId, fieldDefaults }) =>
      buildEmptyIndoorUnitRow({ ...fieldDefaults, id: rowId }),
    activeRow: null,
    replaceMutation: indoorUnitsMutation,
    schemaMutation: indoorUnitsSchemaMutation,
    refetch: indoorUnitsQuery.refetch,
    defaultHiddenColumns: ["notes"],
  });

  if (isLoading) {
    return <p>Loading heat pumps...</p>;
  }
  if (
    isError ||
    !outdoorEquipSlice ||
    !indoorEquipSlice ||
    !outdoorUnitsSlice ||
    !indoorUnitsSlice
  ) {
    return (
      <p className="form-error" role="alert">
        Could not load Heat Pumps.
      </p>
    );
  }
  const aggregateSlice = {
    project_id: outdoorEquipSlice.project_id,
    version_id: outdoorEquipSlice.version_id,
    source: outdoorEquipSlice.source,
    version_etag: outdoorEquipSlice.version_etag,
    draft_etag: outdoorEquipSlice.draft_etag,
    outdoor_equip: outdoorEquipSlice.outdoor_equip,
    indoor_equip: indoorEquipSlice.indoor_equip,
    outdoor_units: outdoorUnitsSlice.outdoor_units,
    indoor_units: indoorUnitsSlice.indoor_units,
    single_select_options: {
      ...outdoorEquipSlice.single_select_options,
      ...indoorEquipSlice.single_select_options,
      ...outdoorUnitsSlice.single_select_options,
      ...indoorUnitsSlice.single_select_options,
    },
  };

  return (
    <div className="hp-panel">
      <AppSubTabs ariaLabel="Heat Pump tables" role="tablist" variant="pills">
        {HEAT_PUMP_LEAF_TABS.map((tab) => (
          <AppSubTabButton
            key={tab.key}
            role="tab"
            active={activeLeaf === tab.key}
            onClick={() => {
              setActiveLeaf(tab.key);
              rememberHeatPumpLeaf(project.id, tab.key);
              navigate(heatPumpLeafPath(project.id, tab.key));
            }}
          >
            {tab.label}
          </AppSubTabButton>
        ))}
      </AppSubTabs>
      {activeLeaf === "equipment-outdoor" ? (
        <OutdoorEquipTable
          projectId={project.id}
          btNumber={project.bt_number}
          slice={aggregateSlice}
          leafSlice={outdoorEquipSlice}
          controller={outdoorEquipController}
          outdoorUnitsController={outdoorUnitsController}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : activeLeaf === "equipment-indoor" ? (
        <IndoorEquipTable
          projectId={project.id}
          slice={aggregateSlice}
          leafSlice={indoorEquipSlice}
          controller={indoorEquipController}
          indoorUnitsController={indoorUnitsController}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : activeLeaf === "units-outdoor" ? (
        <OutdoorUnitsTable
          projectId={project.id}
          slice={aggregateSlice}
          leafSlice={outdoorUnitsSlice}
          controller={outdoorUnitsController}
          indoorUnitsController={indoorUnitsController}
          outdoorEquipController={outdoorEquipController}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : (
        <IndoorUnitsTable
          projectId={project.id}
          slice={aggregateSlice}
          leafSlice={indoorUnitsSlice}
          controller={indoorUnitsController}
          indoorEquipController={indoorEquipController}
          outdoorUnitsController={outdoorUnitsController}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      )}
    </div>
  );
}

function sanitizeColumns(
  fieldDefs: readonly { field_key: string; display_name: string }[] | undefined,
) {
  return (fieldDefs ?? []).map(
    (fieldDef): DataTableColumnDef<unknown> => ({
      id: fieldDef.field_key,
      fieldKey: fieldDef.field_key,
      header: fieldDef.display_name,
      accessor: () => null,
    }),
  );
}

const EMPTY_OUTDOOR_EQUIP_SLICE = {
  project_id: "",
  version_id: "",
  source: "draft" as const,
  version_etag: "",
  draft_etag: null,
  outdoor_equip: [],
  field_defs: [],
  single_select_options: {},
};
const EMPTY_INDOOR_EQUIP_SLICE = {
  ...EMPTY_OUTDOOR_EQUIP_SLICE,
  indoor_equip: [],
  outdoor_equip: undefined,
};
const EMPTY_OUTDOOR_UNITS_SLICE = {
  ...EMPTY_OUTDOOR_EQUIP_SLICE,
  outdoor_units: [],
  outdoor_equip: undefined,
};
const EMPTY_INDOOR_UNITS_SLICE = {
  ...EMPTY_OUTDOOR_EQUIP_SLICE,
  indoor_units: [],
  outdoor_equip: undefined,
};
