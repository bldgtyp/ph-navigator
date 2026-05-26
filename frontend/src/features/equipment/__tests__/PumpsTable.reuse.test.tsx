import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyViewState, type TableSchema } from "../../../shared/ui/data-table";
import { PumpsTable } from "../components/PumpsTable";
import { pumpsTableFieldDefs } from "../lib";
import type { PumpRow, PumpsSlice } from "../types";

const option = { id: "opt_circ", label: "Circulator", color: "#3b82f6", order: 0 };

function buildSlice(rows: PumpRow[]): PumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    pumps: rows,
    single_select_options: { "pumps.device_type": [option] },
  };
}

function buildPump(overrides: Partial<PumpRow> = {}): PumpRow {
  return {
    id: "pmp_1",
    device_type: "opt_circ",
    use: "DHW recirc",
    tag: "P-1",
    manufacturer: null,
    model: null,
    volts: 120,
    phase: 1,
    horse_power: null,
    wattage: 45,
    flow_gpm: null,
    runtime_khr_yr: null,
    notes: null,
    link: null,
    datasheet_asset_ids: [],
    ...overrides,
  };
}

describe("PumpsTable DataTable reuse", () => {
  test("renders fixed pump columns and single-select labels", () => {
    const slice = buildSlice([buildPump()]);
    const fieldDefs = pumpsTableFieldDefs(slice);
    const tableSchema: TableSchema = {
      fieldDefs,
      customFields: [],
      coreFieldKeys: new Set(fieldDefs.map((field) => field.field_key)),
      schemaFingerprint: "test",
      mintCustomFieldId: () => "cf_test",
    };
    render(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByText("P-1")).toBeInTheDocument();
    expect(screen.getByText("Circulator")).toBeInTheDocument();
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildSlice([buildPump()]);
    const fieldDefs = pumpsTableFieldDefs(slice);
    const tableSchema: TableSchema = {
      fieldDefs,
      customFields: [],
      coreFieldKeys: new Set(fieldDefs.map((field) => field.field_key)),
      schemaFingerprint: "test",
      mintCustomFieldId: () => "cf_test",
    };
    const onWrite = vi.fn().mockResolvedValue(undefined);
    render(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("P-1"));
    await user.keyboard("{Control>}a{/Control}P-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });
});
