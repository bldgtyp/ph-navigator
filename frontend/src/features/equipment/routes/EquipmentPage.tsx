import "../equipment.css";
import type { ProjectDetail } from "../../projects/types";
import {
  ProjectTableViewsBatchProvider,
  useProjectTableViewsBatchValue,
} from "../../table_views/batchContext";
import {
  useAppliancesSliceQuery,
  useElectricHeatersSliceQuery,
  useFansSliceQuery,
  useHotWaterHeatersSliceQuery,
  useHotWaterTanksSliceQuery,
  usePumpsSliceQuery,
  useVentilatorsSliceQuery,
} from "../hooks";
import {
  APPLIANCES_TABLE_NAME,
  ELECTRIC_HEATERS_TABLE_NAME,
  FANS_TABLE_NAME,
  HOT_WATER_HEATERS_TABLE_NAME,
  HOT_WATER_TANKS_TABLE_NAME,
  PUMPS_TABLE_NAME,
  VENTILATORS_TABLE_NAME,
} from "../types";
import { EquipmentPageBody } from "./EquipmentPageBody";

// The seven equipment sub-tables all mount on page load (each
// `useSliceTableController` runs unconditionally in `EquipmentPageBody`), so
// their view-state reads collapse into one batch request. Module-constant for
// stable identity — the batch provider keys its fetch effect on this set.
const EQUIPMENT_VIEW_TABLE_KEYS = [
  VENTILATORS_TABLE_NAME,
  PUMPS_TABLE_NAME,
  FANS_TABLE_NAME,
  HOT_WATER_HEATERS_TABLE_NAME,
  HOT_WATER_TANKS_TABLE_NAME,
  ELECTRIC_HEATERS_TABLE_NAME,
  APPLIANCES_TABLE_NAME,
];

export function EquipmentPage({ project }: { project: ProjectDetail }) {
  const ventilatorsQuery = useVentilatorsSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const pumpsQuery = usePumpsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const fansQuery = useFansSliceQuery(project.id, project.active_version_id, project.access_mode);
  const hotWaterHeatersQuery = useHotWaterHeatersSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const hotWaterTanksQuery = useHotWaterTanksSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const electricHeatersQuery = useElectricHeatersSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const appliancesQuery = useAppliancesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  // One batch read for all seven sub-tables' view configs (editor-only),
  // consumed by each table's `useProjectTableViewState` via context. Called
  // before the loading/error early-returns so hook order stays stable.
  const tableViewsBatch = useProjectTableViewsBatchValue({
    projectId: project.id,
    tableKeys: EQUIPMENT_VIEW_TABLE_KEYS,
    enabled: project.access_mode === "editor",
  });
  if (
    ventilatorsQuery.isLoading ||
    pumpsQuery.isLoading ||
    fansQuery.isLoading ||
    hotWaterHeatersQuery.isLoading ||
    hotWaterTanksQuery.isLoading ||
    electricHeatersQuery.isLoading ||
    appliancesQuery.isLoading
  ) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p>Loading equipment...</p>
      </section>
    );
  }
  if (
    ventilatorsQuery.isError ||
    !ventilatorsQuery.data ||
    pumpsQuery.isError ||
    !pumpsQuery.data ||
    fansQuery.isError ||
    !fansQuery.data ||
    hotWaterHeatersQuery.isError ||
    !hotWaterHeatersQuery.data ||
    hotWaterTanksQuery.isError ||
    !hotWaterTanksQuery.data ||
    electricHeatersQuery.isError ||
    !electricHeatersQuery.data ||
    appliancesQuery.isError ||
    !appliancesQuery.data
  ) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p className="form-error" role="alert">
          Could not load Equipment.
        </p>
      </section>
    );
  }
  return (
    <ProjectTableViewsBatchProvider value={tableViewsBatch}>
      <EquipmentPageBody
        project={project}
        ventilatorsSlice={ventilatorsQuery.data}
        refetchVentilators={ventilatorsQuery.refetch}
        pumpsSlice={pumpsQuery.data}
        refetchPumps={pumpsQuery.refetch}
        fansSlice={fansQuery.data}
        refetchFans={fansQuery.refetch}
        hotWaterHeatersSlice={hotWaterHeatersQuery.data}
        refetchHotWaterHeaters={hotWaterHeatersQuery.refetch}
        hotWaterTanksSlice={hotWaterTanksQuery.data}
        refetchHotWaterTanks={hotWaterTanksQuery.refetch}
        electricHeatersSlice={electricHeatersQuery.data}
        refetchElectricHeaters={electricHeatersQuery.refetch}
        appliancesSlice={appliancesQuery.data}
        refetchAppliances={appliancesQuery.refetch}
      />
    </ProjectTableViewsBatchProvider>
  );
}
