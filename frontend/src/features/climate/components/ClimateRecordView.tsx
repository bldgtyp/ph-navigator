import { useState } from "react";
import type { UnitSystem } from "../../../lib/units";
import type { ClimateRecord } from "../types";
import { ClimateRecordCharts } from "./ClimateRecordCharts";
import { ClimateRecordTable } from "./ClimateRecordTable";

type RecordView = "table" | "charts";

// Wraps the standardized-record presentation with a Table/Charts toggle: the
// tables (3a) show every field incl. scalars + design conditions; the charts
// (3c) plot the monthly temperature + radiation series. Both share the IP/SI
// unit system from the tab.
export function ClimateRecordView({
  record,
  unitSystem,
}: {
  record: ClimateRecord;
  unitSystem: UnitSystem;
}) {
  const [view, setView] = useState<RecordView>("table");
  return (
    <div className="climate-record-view">
      <div className="climate-record-view-toggle" role="group" aria-label="Climate record view">
        <ViewButton current={view} value="table" onSelect={setView}>
          Table
        </ViewButton>
        <ViewButton current={view} value="charts" onSelect={setView}>
          Charts
        </ViewButton>
      </div>
      {view === "table" ? (
        <ClimateRecordTable record={record} unitSystem={unitSystem} />
      ) : (
        <ClimateRecordCharts record={record} unitSystem={unitSystem} />
      )}
    </div>
  );
}

function ViewButton({
  current,
  value,
  onSelect,
  children,
}: {
  current: RecordView;
  value: RecordView;
  onSelect: (view: RecordView) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      className={active ? "secondary-button active" : "secondary-button"}
      aria-pressed={active}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}
