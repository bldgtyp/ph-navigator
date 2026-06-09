// §A2 regression: DataTable.tsx previously omitted `linkedRecordTargets`
// in its <FieldConfigModal> invocation, which silently rendered the
// target-table dropdown empty whenever the consumer (RoomsTable, etc.)
// passed the prop through. The unit FieldConfigModal test covers the
// dropdown behavior given the prop; this test pins the wiring layer.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";

// Mock the FieldConfigModal so we can spy on the props the DataTable
// forwards. The mock keeps the module identity stable and just renders
// a probe element exposing the relevant prop count in its dataset.
const seenProps: ComponentProps<typeof import("../components/FieldConfigModal").FieldConfigModal>[] =
  [];
vi.mock("../components/FieldConfigModal", () => ({
  FieldConfigModal: (props: Record<string, unknown>) => {
    seenProps.push(props as never);
    return props.open ? (
      <div
        data-testid="fcm-spy"
        data-targets={JSON.stringify(props.linkedRecordTargets ?? null)}
      />
    ) : null;
  },
}));

// Import after the mock so DataTable picks up the spy.
import { DataTable } from "../DataTable";
import { emptyViewState, type DataTableColumnDef, type FieldDef } from "../types";

type Row = { id: string; cf_pumps: string[] };

const rows: Row[] = [{ id: "rm_1", cf_pumps: [] }];
const fieldDefs: FieldDef[] = [
  {
    field_key: "cf_pumps",
    field_type: "linked_record",
    display_name: "Pumps",
    custom_field_type: "linked_record",
    linked_record_config: {
      target_table_path: ["equipment", "pumps"],
      max_links: null,
    },
  },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "cf_pumps", fieldKey: "cf_pumps", header: "Pumps", accessor: (row) => row.cf_pumps },
];

describe("DataTable → FieldConfigModal linkedRecordTargets forwarding", () => {
  test("forwards linkedRecordTargets when the config modal opens", () => {
    const targets = [{ path: ["equipment", "pumps"], label: "Pumps" }];
    render(
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        onEditCustomFieldBundle={vi.fn()}
        linkedRecordTargets={targets}
      />,
    );

    // Double-click the custom-field header to open the config modal.
    const headers = screen.getAllByRole("columnheader");
    const pumpsHeader = headers.find((h) => h.textContent?.includes("Pumps"));
    expect(pumpsHeader).toBeTruthy();
    fireEvent.doubleClick(pumpsHeader!);

    const probe = screen.getByTestId("fcm-spy");
    expect(JSON.parse(probe.dataset.targets ?? "null")).toEqual(targets);
  });
});
