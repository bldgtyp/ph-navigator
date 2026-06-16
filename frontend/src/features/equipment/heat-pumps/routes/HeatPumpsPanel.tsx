import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppSubTabButton, AppSubTabs } from "../../../../shared/ui/AppSubTabs";
import type { ProjectDetail } from "../../../projects/types";
import { useHeatPumpsQuery } from "../api";
import { IndoorEquipTable } from "../components/IndoorEquipTable";
import { IndoorUnitsTable } from "../components/IndoorUnitsTable";
import { OutdoorEquipTable } from "../components/OutdoorEquipTable";
import { OutdoorUnitsTable } from "../components/OutdoorUnitsTable";
import {
  DEFAULT_HEAT_PUMP_LEAF,
  HEAT_PUMP_LEAF_TABS,
  heatPumpLeafPath,
  leafFromPath,
  readRememberedHeatPumpLeaf,
  rememberHeatPumpLeaf,
  type HeatPumpLeafKey,
} from "./heatPumpLeafTabs";

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
