import "../../assets/attachments.css";
import "../equipment.css";
import type { ProjectDetail } from "../../projects/types";
import {
  useAppliancesSliceQuery,
  useElectricHeatersSliceQuery,
  useFansSliceQuery,
  useHotWaterHeatersSliceQuery,
  usePumpsSliceQuery,
  useVentilatorsSliceQuery,
} from "../hooks";
import { EquipmentPageBody } from "./EquipmentPageBody";

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
  if (
    ventilatorsQuery.isLoading ||
    pumpsQuery.isLoading ||
    fansQuery.isLoading ||
    hotWaterHeatersQuery.isLoading ||
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
      electricHeatersSlice={electricHeatersQuery.data}
      refetchElectricHeaters={electricHeatersQuery.refetch}
      appliancesSlice={appliancesQuery.data}
      refetchAppliances={appliancesQuery.refetch}
    />
  );
}
