import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSubTabButton, AppSubTabs } from "../../../../shared/ui/AppSubTabs";
import type { ProjectDetail } from "../../../projects/types";
import { useHeatPumpsQuery } from "../api";
import { OutdoorEquipTable } from "../components/OutdoorEquipTable";

const HEAT_PUMP_LEAF_TABS = [
  { key: "equipment-outdoor", label: "Equipment - Outdoor", phase: 1 },
  { key: "equipment-indoor", label: "Equipment - Indoor", phase: 2 },
  { key: "units-outdoor", label: "Units - Outdoor", phase: 3 },
  { key: "units-indoor", label: "Units - Indoor", phase: 3 },
] as const;

type HeatPumpLeafKey = (typeof HEAT_PUMP_LEAF_TABS)[number]["key"];

export function HeatPumpsPanel({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const params = useParams();
  const nestedPath = params["*"] ?? "";
  const requestedLeaf = leafFromPath(nestedPath);
  const query = useHeatPumpsQuery(
    project.id,
    Boolean(project.active_version_id),
    project.access_mode,
  );
  const [activeLeaf, setActiveLeaf] = useState<HeatPumpLeafKey>(
    requestedLeaf ?? "equipment-outdoor",
  );
  const activeMeta = useMemo(
    () => HEAT_PUMP_LEAF_TABS.find((tab) => tab.key === activeLeaf) ?? HEAT_PUMP_LEAF_TABS[0],
    [activeLeaf],
  );

  if (query.isLoading) {
    return <p>Loading heat pumps...</p>;
  }
  if (query.isError || !query.data) {
    return (
      <p className="form-error" role="alert">
        Could not load Heat Pumps.
      </p>
    );
  }

  return (
    <div className="hp-panel">
      <AppSubTabs ariaLabel="Heat Pump tables" role="tablist">
        {HEAT_PUMP_LEAF_TABS.map((tab) => (
          <AppSubTabButton
            key={tab.key}
            role="tab"
            active={activeLeaf === tab.key}
            onClick={() => {
              setActiveLeaf(tab.key);
              navigate(`/projects/${project.id}/equipment/heat-pumps/${tab.key}`);
            }}
          >
            {tab.label}
          </AppSubTabButton>
        ))}
      </AppSubTabs>
      {activeLeaf === "equipment-outdoor" ? (
        <OutdoorEquipTable
          projectId={project.id}
          slice={query.data}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : (
        <div className="hp-coming-soon" role="status">
          Coming in Phase {activeMeta.phase}
        </div>
      )}
    </div>
  );
}

function leafFromPath(path: string): HeatPumpLeafKey | null {
  const [, leaf] = path.split("/");
  if (leaf && HEAT_PUMP_LEAF_TABS.some((tab) => tab.key === leaf)) {
    return leaf as HeatPumpLeafKey;
  }
  return null;
}
