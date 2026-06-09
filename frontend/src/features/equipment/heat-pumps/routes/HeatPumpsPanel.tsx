import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSubTabButton, AppSubTabs } from "../../../../shared/ui/AppSubTabs";
import type { ProjectDetail } from "../../../projects/types";
import { useHeatPumpsQuery } from "../api";
import { IndoorEquipTable } from "../components/IndoorEquipTable";
import { IndoorUnitsTable } from "../components/IndoorUnitsTable";
import { OutdoorEquipTable } from "../components/OutdoorEquipTable";
import { OutdoorUnitsTable } from "../components/OutdoorUnitsTable";

const HEAT_PUMP_LEAF_TABS = [
  { key: "equipment-outdoor", label: "Equipment - Outdoor" },
  { key: "equipment-indoor", label: "Equipment - Indoor" },
  { key: "units-outdoor", label: "Units - Outdoor" },
  { key: "units-indoor", label: "Units - Indoor" },
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
      ) : activeLeaf === "equipment-indoor" ? (
        <IndoorEquipTable
          projectId={project.id}
          slice={query.data}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : activeLeaf === "units-outdoor" ? (
        <OutdoorUnitsTable
          projectId={project.id}
          slice={query.data}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      ) : (
        <IndoorUnitsTable
          projectId={project.id}
          slice={query.data}
          isEditor={project.access_mode === "editor"}
          versionLocked={project.active_version?.locked ?? false}
        />
      )}
    </div>
  );
}

function leafFromPath(path: string): HeatPumpLeafKey | null {
  const [leaf] = path.split("/");
  if (leaf && HEAT_PUMP_LEAF_TABS.some((tab) => tab.key === leaf)) {
    return leaf as HeatPumpLeafKey;
  }
  return null;
}
