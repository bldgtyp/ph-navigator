import { useState } from "react";
import { createRoot } from "react-dom/client";

import "../../../src/App.css";
import {
  ReportTable,
  type ReportTableColumn,
} from "../../../src/shared/ui/report-table/ReportTable";

type FixtureRow = {
  id: string;
  name: string;
};

const ROWS: FixtureRow[] = [
  { id: "first", name: "First" },
  { id: "middle", name: "Middle" },
  { id: "last", name: "Last" },
];

const COLUMNS: ReportTableColumn<FixtureRow>[] = [
  { key: "name", header: "Name", primary: true, width: "180px", render: (row) => row.name },
  { key: "value", header: "Value", width: "180px", render: () => "Value" },
  { key: "more", header: "More", width: "180px", render: () => "More value" },
];

export function ReportTableFixture() {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const withRowAction = new URLSearchParams(window.location.search).get("rowAction") !== "0";

  return (
    <main data-testid="report-table-fixture" style={{ margin: 24, width: 420 }}>
      <ReportTable
        rows={ROWS}
        columns={COLUMNS}
        getRowId={(row) => row.id}
        expandedRowId={expandedRowId}
        onToggleExpand={(id) => setExpandedRowId((current) => (current === id ? null : id))}
        renderExpansion={() => (
          <ReportTable
            rows={[{ id: "nested", name: "Nested primary" }]}
            columns={COLUMNS.slice(0, 2)}
            getRowId={(row) => row.id}
          />
        )}
        renderRowAction={withRowAction ? () => <button type="button">Edit</button> : undefined}
      />
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("ReportTable fixture root not found.");
createRoot(root).render(<ReportTableFixture />);
