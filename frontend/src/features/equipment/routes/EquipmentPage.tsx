import "../equipment.css";
import type { ProjectDetail } from "../../projects/types";
import { useDraftTablesBatchSeed } from "../../project_document/draftTablesBatchSeed";
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
// both their view-state reads and their draft-slice reads collapse into one
// batch request each. Module-constant for stable identity — the view-batch
// provider and the draft-slice seed both key their fetch effects on this set.
const EQUIPMENT_TABLE_NAMES = [
  VENTILATORS_TABLE_NAME,
  PUMPS_TABLE_NAME,
  FANS_TABLE_NAME,
  HOT_WATER_HEATERS_TABLE_NAME,
  HOT_WATER_TANKS_TABLE_NAME,
  ELECTRIC_HEATERS_TABLE_NAME,
  APPLIANCES_TABLE_NAME,
];

export function EquipmentPage({ project }: { project: ProjectDetail }) {
  // One batch read for all seven sub-tables' draft slices (editor-only), seeded
  // into the per-table editor caches before their `useSliceQuery` would GET.
  // While seeding, the per-table queries are gated (`enabled` below) so they
  // read the seed instead of fanning out. Called first so hook order is stable.
  const { isSeeding } = useDraftTablesBatchSeed({
    projectId: project.id,
    versionId: project.active_version_id,
    tableNames: EQUIPMENT_TABLE_NAMES,
    enabled: project.access_mode === "editor",
  });
  const slicesEnabled = !isSeeding;
  const ventilatorsQuery = useVentilatorsSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const pumpsQuery = usePumpsSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const fansQuery = useFansSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const hotWaterHeatersQuery = useHotWaterHeatersSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const hotWaterTanksQuery = useHotWaterTanksSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const electricHeatersQuery = useElectricHeatersSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  const appliancesQuery = useAppliancesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    slicesEnabled,
  );
  // One batch read for all seven sub-tables' view configs (editor-only),
  // consumed by each table's `useProjectTableViewState` via context. Called
  // before the loading/error early-returns so hook order stays stable.
  const tableViewsBatch = useProjectTableViewsBatchValue({
    projectId: project.id,
    tableKeys: EQUIPMENT_TABLE_NAMES,
    enabled: project.access_mode === "editor",
  });
  // Fixed-length, constant-order list of the seven query handles for the
  // loading aggregation (the individual `const`s above are still needed to pass
  // each slice as a named prop). The error guard stays an explicit per-query
  // chain so TS narrows each `.data` to non-undefined for the props below.
  const sliceQueries = [
    ventilatorsQuery,
    pumpsQuery,
    fansQuery,
    hotWaterHeatersQuery,
    hotWaterTanksQuery,
    electricHeatersQuery,
    appliancesQuery,
  ];
  if (isSeeding || sliceQueries.some((query) => query.isLoading)) {
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
