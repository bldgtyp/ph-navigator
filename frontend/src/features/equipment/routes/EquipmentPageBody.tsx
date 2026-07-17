// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import { useMemo } from "react";
import { useActiveEquipmentTabFromUrl } from "./useActiveEquipmentTabFromUrl";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppSubTabButton, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import type { ProjectDetail } from "../../projects/types";
import { AppliancesTableSlot } from "../components/AppliancesTableSlot";
import { ElectricHeatersTableSlot } from "../components/ElectricHeatersTableSlot";
import { FansTableSlot } from "../components/FansTableSlot";
import { HotWaterHeatersTableSlot } from "../components/HotWaterHeatersTableSlot";
import { HotWaterTanksTableSlot } from "../components/HotWaterTanksTableSlot";
import { PumpsTableSlot } from "../components/PumpsTableSlot";
import { VentilatorsTableSlot } from "../components/VentilatorsTableSlot";
import { rememberedHeatPumpLeafPath } from "../heat-pumps/routes/heatPumpLeafTabs";
import { HeatPumpsPanel } from "../heat-pumps/routes/HeatPumpsPanel";
import {
  useAppliancesSchemaMutation,
  useElectricHeatersSchemaMutation,
  useFansSchemaMutation,
  useHotWaterHeatersSchemaMutation,
  useHotWaterTanksSchemaMutation,
  usePumpsSchemaMutation,
  useReplaceAppliancesSliceMutation,
  useReplaceElectricHeatersSliceMutation,
  useReplaceFansSliceMutation,
  useReplaceHotWaterHeatersSliceMutation,
  useReplaceHotWaterTanksSliceMutation,
  useReplacePumpsSliceMutation,
  useReplaceVentilatorsSliceMutation,
  useVentilatorsSchemaMutation,
} from "../hooks";
import {
  appliancesFieldOverlay,
  appliancesTableColumnsForSanitize,
  appliancesTableFieldDefs,
  electricHeatersFieldOverlay,
  electricHeatersTableColumnsForSanitize,
  electricHeatersTableFieldDefs,
  fansFieldOverlay,
  fansTableColumnsForSanitize,
  fansTableFieldDefs,
  hotWaterHeatersFieldOverlay,
  hotWaterHeatersTableColumnsForSanitize,
  hotWaterHeatersTableFieldDefs,
  hotWaterTanksFieldOverlay,
  hotWaterTanksTableColumnsForSanitize,
  hotWaterTanksTableFieldDefs,
  pumpsFieldOverlay,
  pumpsTableColumnsForSanitize,
  pumpsTableFieldDefs,
  ventilatorsFieldOverlay,
  ventilatorsTableColumnsForSanitize,
  ventilatorsTableFieldDefs,
  wasLocalDraftTouched,
} from "../lib";
import { appliancesPayloadBuilders } from "../lib/appliancesController";
import { makeBuildEmptyApplianceRow } from "../lib/buildEmptyApplianceRow";
import { makeBuildEmptyElectricHeaterRow } from "../lib/buildEmptyElectricHeaterRow";
import { makeBuildEmptyFanRow } from "../lib/buildEmptyFanRow";
import { makeBuildEmptyHotWaterHeaterRow } from "../lib/buildEmptyHotWaterHeaterRow";
import { makeBuildEmptyHotWaterTankRow } from "../lib/buildEmptyHotWaterTankRow";
import { makeBuildEmptyPumpRow } from "../lib/buildEmptyPumpRow";
import { makeBuildEmptyVentilatorRow } from "../lib/buildEmptyVentilatorRow";
import { electricHeatersPayloadBuilders } from "../lib/electricHeatersController";
import { fansPayloadBuilders } from "../lib/fansController";
import { hotWaterHeatersPayloadBuilders } from "../lib/hotWaterHeatersController";
import { hotWaterTanksPayloadBuilders } from "../lib/hotWaterTanksController";
import { pumpsPayloadBuilders } from "../lib/pumpsController";
import { useEquipmentTablePreview } from "../lib/useEquipmentTablePreview";
import { ventilatorsPayloadBuilders } from "../lib/ventilatorsController";
import {
  APPLIANCES_TABLE_NAME,
  ELECTRIC_HEATERS_TABLE_NAME,
  FANS_TABLE_NAME,
  HOT_WATER_HEATERS_TABLE_NAME,
  HOT_WATER_TANKS_TABLE_NAME,
  PUMPS_TABLE_NAME,
  VENTILATORS_TABLE_NAME,
  type AppliancesSlice,
  type ElectricHeatersSlice,
  type FansSlice,
  type HotWaterHeatersSlice,
  type HotWaterTanksSlice,
  type PumpsSlice,
  type VentilatorsSlice,
} from "../types";
import {
  APPLIANCES_CONFLICT_MESSAGES,
  ELECTRIC_HEATERS_CONFLICT_MESSAGES,
  EQUIPMENT_TABS,
  FANS_CONFLICT_MESSAGES,
  HOT_WATER_HEATERS_CONFLICT_MESSAGES,
  HOT_WATER_TANKS_CONFLICT_MESSAGES,
  PUMPS_CONFLICT_MESSAGES,
  VENTILATORS_CONFLICT_MESSAGES,
  equipmentTabLabel,
} from "./equipmentPageConfig";
import { addRowButton } from "../../../shared/ui/data-table";
import { insertEquipmentRow } from "./equipmentRowActions";

export function EquipmentPageBody(props: {
  project: ProjectDetail;
  ventilatorsSlice: VentilatorsSlice;
  refetchVentilators: () => Promise<unknown>;
  pumpsSlice: PumpsSlice;
  refetchPumps: () => Promise<unknown>;
  fansSlice: FansSlice;
  refetchFans: () => Promise<unknown>;
  hotWaterHeatersSlice: HotWaterHeatersSlice;
  refetchHotWaterHeaters: () => Promise<unknown>;
  hotWaterTanksSlice: HotWaterTanksSlice;
  refetchHotWaterTanks: () => Promise<unknown>;
  electricHeatersSlice: ElectricHeatersSlice;
  refetchElectricHeaters: () => Promise<unknown>;
  appliancesSlice: AppliancesSlice;
  refetchAppliances: () => Promise<unknown>;
}) {
  const {
    project,
    ventilatorsSlice,
    refetchVentilators,
    pumpsSlice,
    refetchPumps,
    fansSlice,
    refetchFans,
    hotWaterHeatersSlice,
    refetchHotWaterHeaters,
    hotWaterTanksSlice,
    refetchHotWaterTanks,
    electricHeatersSlice,
    refetchElectricHeaters,
    appliancesSlice,
    refetchAppliances,
  } = props;
  const activeVersionId = project.active_version_id;
  const ventilatorsPreview = useEquipmentTablePreview({
    slice: ventilatorsSlice,
    tableKey: VENTILATORS_TABLE_NAME,
    fieldOverlay: ventilatorsFieldOverlay,
    tableFieldDefs: ventilatorsTableFieldDefs,
    columnsForSanitize: ventilatorsTableColumnsForSanitize,
  });
  const pumpsPreview = useEquipmentTablePreview({
    slice: pumpsSlice,
    tableKey: PUMPS_TABLE_NAME,
    fieldOverlay: pumpsFieldOverlay,
    tableFieldDefs: pumpsTableFieldDefs,
    columnsForSanitize: pumpsTableColumnsForSanitize,
  });
  const fansPreview = useEquipmentTablePreview({
    slice: fansSlice,
    tableKey: FANS_TABLE_NAME,
    fieldOverlay: fansFieldOverlay,
    tableFieldDefs: fansTableFieldDefs,
    columnsForSanitize: fansTableColumnsForSanitize,
  });
  const hotWaterHeatersPreview = useEquipmentTablePreview({
    slice: hotWaterHeatersSlice,
    tableKey: HOT_WATER_HEATERS_TABLE_NAME,
    fieldOverlay: hotWaterHeatersFieldOverlay,
    tableFieldDefs: hotWaterHeatersTableFieldDefs,
    columnsForSanitize: hotWaterHeatersTableColumnsForSanitize,
  });
  const hotWaterTanksPreview = useEquipmentTablePreview({
    slice: hotWaterTanksSlice,
    tableKey: HOT_WATER_TANKS_TABLE_NAME,
    fieldOverlay: hotWaterTanksFieldOverlay,
    tableFieldDefs: hotWaterTanksTableFieldDefs,
    columnsForSanitize: hotWaterTanksTableColumnsForSanitize,
  });
  const electricHeatersPreview = useEquipmentTablePreview({
    slice: electricHeatersSlice,
    tableKey: ELECTRIC_HEATERS_TABLE_NAME,
    fieldOverlay: electricHeatersFieldOverlay,
    tableFieldDefs: electricHeatersTableFieldDefs,
    columnsForSanitize: electricHeatersTableColumnsForSanitize,
  });
  const appliancesPreview = useEquipmentTablePreview({
    slice: appliancesSlice,
    tableKey: APPLIANCES_TABLE_NAME,
    fieldOverlay: appliancesFieldOverlay,
    tableFieldDefs: appliancesTableFieldDefs,
    columnsForSanitize: appliancesTableColumnsForSanitize,
  });
  const buildEmptyVentilatorRow = useMemo(() => makeBuildEmptyVentilatorRow(), []);
  const buildEmptyPumpRow = useMemo(() => makeBuildEmptyPumpRow(), []);
  const buildEmptyFanRow = useMemo(() => makeBuildEmptyFanRow(), []);
  const buildEmptyHotWaterHeaterRow = useMemo(() => makeBuildEmptyHotWaterHeaterRow(), []);
  const buildEmptyHotWaterTankRow = useMemo(() => makeBuildEmptyHotWaterTankRow(), []);
  const buildEmptyElectricHeaterRow = useMemo(() => makeBuildEmptyElectricHeaterRow(), []);
  const buildEmptyApplianceRow = useMemo(() => makeBuildEmptyApplianceRow(), []);
  const ventilatorsReplaceMutation = useReplaceVentilatorsSliceMutation(
    project.id,
    activeVersionId,
  );
  const ventilatorsSchemaMutation = useVentilatorsSchemaMutation(project.id, activeVersionId);
  const pumpsReplaceMutation = useReplacePumpsSliceMutation(project.id, activeVersionId);
  const pumpsSchemaMutation = usePumpsSchemaMutation(project.id, activeVersionId);
  const fansReplaceMutation = useReplaceFansSliceMutation(project.id, activeVersionId);
  const fansSchemaMutation = useFansSchemaMutation(project.id, activeVersionId);
  const hotWaterHeatersReplaceMutation = useReplaceHotWaterHeatersSliceMutation(
    project.id,
    activeVersionId,
  );
  const hotWaterHeatersSchemaMutation = useHotWaterHeatersSchemaMutation(
    project.id,
    activeVersionId,
  );
  const hotWaterTanksReplaceMutation = useReplaceHotWaterTanksSliceMutation(
    project.id,
    activeVersionId,
  );
  const hotWaterTanksSchemaMutation = useHotWaterTanksSchemaMutation(project.id, activeVersionId);
  const electricHeatersReplaceMutation = useReplaceElectricHeatersSliceMutation(
    project.id,
    activeVersionId,
  );
  const electricHeatersSchemaMutation = useElectricHeatersSchemaMutation(
    project.id,
    activeVersionId,
  );
  const appliancesReplaceMutation = useReplaceAppliancesSliceMutation(project.id, activeVersionId);
  const appliancesSchemaMutation = useAppliancesSchemaMutation(project.id, activeVersionId);
  // PRD Q19 cross-tab navigation: `?tab=<key>` seeds the initial active
  // sub-tab so a Rooms→Pumps pill click lands on the right table.
  // `?focus=<row_id>` is forwarded to the active slot for
  // `useRowFocusHighlight`. The activeTab is local state once mounted —
  // subsequent in-page tab clicks are not pushed back to the URL (the
  // existing UX never did, and doing so risks fighting the pill-click
  // navigation that brought the user here).
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const focusRowId = searchParams.get("focus");
  const requestedTabKey = searchParams.get("tab");
  const nestedPath = params["*"] ?? "";
  const requestedNestedTab = nestedPath.startsWith("heat-pumps") ? "heat-pumps" : null;
  const [activeTab, setActiveTab] = useActiveEquipmentTabFromUrl(
    requestedNestedTab ?? requestedTabKey,
  );
  const selectTab = (next: typeof activeTab) => {
    setActiveTab(next);
    if (next === "heat-pumps") {
      navigate(rememberedHeatPumpLeafPath(project.id));
    } else {
      navigate(`/projects/${project.id}/equipment?tab=${next}`);
    }
  };

  const ventilatorsController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: VENTILATORS_TABLE_NAME,
    slice: ventilatorsSlice,
    fieldDefs: ventilatorsPreview.fieldDefs,
    fieldOverlay: ventilatorsPreview.fieldRenderOverlay,
    singleSelectOptions: ventilatorsSlice.single_select_options,
    columnsForSanitize: ventilatorsPreview.columnsForSanitize,
    payloadBuilders: ventilatorsPayloadBuilders,
    conflictMessages: VENTILATORS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyVentilatorRow,
    activeRow: null,
    replaceMutation: ventilatorsReplaceMutation,
    schemaMutation: ventilatorsSchemaMutation,
    refetch: refetchVentilators,
  });

  const pumpsController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: PUMPS_TABLE_NAME,
    slice: pumpsSlice,
    fieldDefs: pumpsPreview.fieldDefs,
    fieldOverlay: pumpsPreview.fieldRenderOverlay,
    singleSelectOptions: pumpsSlice.single_select_options,
    columnsForSanitize: pumpsPreview.columnsForSanitize,
    payloadBuilders: pumpsPayloadBuilders,
    conflictMessages: PUMPS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyPumpRow,
    activeRow: null,
    replaceMutation: pumpsReplaceMutation,
    schemaMutation: pumpsSchemaMutation,
    refetch: refetchPumps,
  });

  const fansController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: FANS_TABLE_NAME,
    slice: fansSlice,
    fieldDefs: fansPreview.fieldDefs,
    fieldOverlay: fansPreview.fieldRenderOverlay,
    singleSelectOptions: fansSlice.single_select_options,
    columnsForSanitize: fansPreview.columnsForSanitize,
    payloadBuilders: fansPayloadBuilders,
    conflictMessages: FANS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyFanRow,
    activeRow: null,
    replaceMutation: fansReplaceMutation,
    schemaMutation: fansSchemaMutation,
    refetch: refetchFans,
  });

  const hotWaterHeatersController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: HOT_WATER_HEATERS_TABLE_NAME,
    slice: hotWaterHeatersSlice,
    fieldDefs: hotWaterHeatersPreview.fieldDefs,
    fieldOverlay: hotWaterHeatersPreview.fieldRenderOverlay,
    singleSelectOptions: hotWaterHeatersSlice.single_select_options,
    columnsForSanitize: hotWaterHeatersPreview.columnsForSanitize,
    payloadBuilders: hotWaterHeatersPayloadBuilders,
    conflictMessages: HOT_WATER_HEATERS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyHotWaterHeaterRow,
    activeRow: null,
    replaceMutation: hotWaterHeatersReplaceMutation,
    schemaMutation: hotWaterHeatersSchemaMutation,
    refetch: refetchHotWaterHeaters,
  });
  const hotWaterTanksController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: HOT_WATER_TANKS_TABLE_NAME,
    slice: hotWaterTanksSlice,
    fieldDefs: hotWaterTanksPreview.fieldDefs,
    fieldOverlay: hotWaterTanksPreview.fieldRenderOverlay,
    singleSelectOptions: hotWaterTanksSlice.single_select_options,
    columnsForSanitize: hotWaterTanksPreview.columnsForSanitize,
    payloadBuilders: hotWaterTanksPayloadBuilders,
    conflictMessages: HOT_WATER_TANKS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyHotWaterTankRow,
    activeRow: null,
    replaceMutation: hotWaterTanksReplaceMutation,
    schemaMutation: hotWaterTanksSchemaMutation,
    refetch: refetchHotWaterTanks,
  });
  const electricHeatersController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: ELECTRIC_HEATERS_TABLE_NAME,
    slice: electricHeatersSlice,
    fieldDefs: electricHeatersPreview.fieldDefs,
    fieldOverlay: electricHeatersPreview.fieldRenderOverlay,
    singleSelectOptions: electricHeatersSlice.single_select_options,
    columnsForSanitize: electricHeatersPreview.columnsForSanitize,
    payloadBuilders: electricHeatersPayloadBuilders,
    conflictMessages: ELECTRIC_HEATERS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyElectricHeaterRow,
    activeRow: null,
    replaceMutation: electricHeatersReplaceMutation,
    schemaMutation: electricHeatersSchemaMutation,
    refetch: refetchElectricHeaters,
  });
  const appliancesController = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: APPLIANCES_TABLE_NAME,
    slice: appliancesSlice,
    fieldDefs: appliancesPreview.fieldDefs,
    fieldOverlay: appliancesPreview.fieldRenderOverlay,
    singleSelectOptions: appliancesSlice.single_select_options,
    columnsForSanitize: appliancesPreview.columnsForSanitize,
    payloadBuilders: appliancesPayloadBuilders,
    conflictMessages: APPLIANCES_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyApplianceRow,
    activeRow: null,
    replaceMutation: appliancesReplaceMutation,
    schemaMutation: appliancesSchemaMutation,
    refetch: refetchAppliances,
  });
  const activeController =
    activeTab === "ventilators"
      ? ventilatorsController
      : activeTab === "pumps"
        ? pumpsController
        : activeTab === "fans"
          ? fansController
          : activeTab === "hot-water-heaters"
            ? hotWaterHeatersController
            : activeTab === "hot-water-tanks"
              ? hotWaterTanksController
              : activeTab === "electric-heaters"
                ? electricHeatersController
                : activeTab === "appliances"
                  ? appliancesController
                  : pumpsController;
  const activeSlice =
    activeTab === "ventilators"
      ? ventilatorsSlice
      : activeTab === "fans"
        ? fansSlice
        : activeTab === "hot-water-heaters"
          ? hotWaterHeatersSlice
          : activeTab === "hot-water-tanks"
            ? hotWaterTanksSlice
            : activeTab === "electric-heaters"
              ? electricHeatersSlice
              : activeTab === "appliances"
                ? appliancesSlice
                : pumpsSlice;
  const activeConflictMessages =
    activeTab === "ventilators"
      ? VENTILATORS_CONFLICT_MESSAGES
      : activeTab === "fans"
        ? FANS_CONFLICT_MESSAGES
        : activeTab === "hot-water-heaters"
          ? HOT_WATER_HEATERS_CONFLICT_MESSAGES
          : activeTab === "hot-water-tanks"
            ? HOT_WATER_TANKS_CONFLICT_MESSAGES
            : activeTab === "electric-heaters"
              ? ELECTRIC_HEATERS_CONFLICT_MESSAGES
              : activeTab === "appliances"
                ? APPLIANCES_CONFLICT_MESSAGES
                : PUMPS_CONFLICT_MESSAGES;
  const heatPumpsLockedMessage = "This version is locked. Save As to copy it into a new version.";
  const shellIsLocked =
    activeTab === "heat-pumps"
      ? (project.active_version?.locked ?? false)
      : activeController.isLocked;

  const reloadDraft = async () => {
    await activeController.reloadDraft();
  };

  const renderActiveEquipmentTable = () => {
    if (activeTab === "ventilators") {
      return (
        <VentilatorsTableSlot
          controller={ventilatorsController}
          ventilatorsSlice={ventilatorsSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          accessMode={project.access_mode}
          versionLocked={project.active_version?.locked ?? false}
          buildEmptyRow={buildEmptyVentilatorRow}
          footerAction={addRowButton("Add ventilator", ventilatorsController.canEdit, () =>
            insertEquipmentRow(ventilatorsController, "vent"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "pumps") {
      return (
        <PumpsTableSlot
          controller={pumpsController}
          pumpsSlice={pumpsSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          accessMode={project.access_mode}
          versionLocked={project.active_version?.locked ?? false}
          buildEmptyRow={buildEmptyPumpRow}
          footerAction={addRowButton("Add pump", pumpsController.canEdit, () =>
            insertEquipmentRow(pumpsController, "pmp"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "heat-pumps") {
      return <HeatPumpsPanel project={project} />;
    }
    if (activeTab === "fans") {
      return (
        <FansTableSlot
          controller={fansController}
          fansSlice={fansSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyFanRow}
          footerAction={addRowButton("Add fan", fansController.canEdit, () =>
            insertEquipmentRow(fansController, "fan"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "hot-water-heaters") {
      return (
        <HotWaterHeatersTableSlot
          controller={hotWaterHeatersController}
          hotWaterHeatersSlice={hotWaterHeatersSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyHotWaterHeaterRow}
          footerAction={addRowButton(
            "Add hot water heater",
            hotWaterHeatersController.canEdit,
            () => insertEquipmentRow(hotWaterHeatersController, "hwh"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "hot-water-tanks") {
      return (
        <HotWaterTanksTableSlot
          controller={hotWaterTanksController}
          hotWaterTanksSlice={hotWaterTanksSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyHotWaterTankRow}
          footerAction={addRowButton("Add hot water tank", hotWaterTanksController.canEdit, () =>
            insertEquipmentRow(hotWaterTanksController, "hwt"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "electric-heaters") {
      return (
        <ElectricHeatersTableSlot
          controller={electricHeatersController}
          electricHeatersSlice={electricHeatersSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyElectricHeaterRow}
          footerAction={addRowButton("Add electric heater", electricHeatersController.canEdit, () =>
            insertEquipmentRow(electricHeatersController, "heatr"),
          )}
          focusRowId={focusRowId}
        />
      );
    }
    if (activeTab === "appliances") {
      return (
        <AppliancesTableSlot
          controller={appliancesController}
          appliancesSlice={appliancesSlice}
          projectId={project.id}
          activeVersionId={activeVersionId}
          buildEmptyRow={buildEmptyApplianceRow}
          footerAction={addRowButton("Add appliance", appliancesController.canEdit, () =>
            insertEquipmentRow(appliancesController, "appl"),
          )}
          focusRowId={focusRowId}
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
        activeTab !== "heat-pumps" &&
        activeSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, activeSlice.draft_etag)
      }
      draftRestoredMessage={`${equipmentTabLabel(activeTab)} draft restored`}
      isLocked={shellIsLocked}
      lockedMessage={
        activeTab === "heat-pumps" ? heatPumpsLockedMessage : activeConflictMessages.versionLocked
      }
      editBlocker={activeTab === "heat-pumps" ? null : activeController.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={activeTab === "heat-pumps" ? null : activeController.actionError}
    >
      <AppSubTabs ariaLabel="Equipment tables" role="tablist">
        {EQUIPMENT_TABS.map((tab) => (
          <AppSubTabButton
            key={tab.key}
            role="tab"
            active={activeTab === tab.key}
            onClick={() => selectTab(tab.key)}
          >
            {tab.label}
          </AppSubTabButton>
        ))}
      </AppSubTabs>
      {renderActiveEquipmentTable()}
    </SliceTableShell>
  );
}
