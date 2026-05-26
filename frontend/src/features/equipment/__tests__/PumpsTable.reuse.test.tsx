import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState, type TableSchema } from "../../../shared/ui/data-table";
import { PumpsTable } from "../components/PumpsTable";
import { pumpsTableFieldDefs } from "../lib";
import type { PumpRow, PumpsSlice } from "../types";

const option = { id: "opt_circ", label: "Circulator", color: "#3b82f6", order: 0 };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({
        items: [
          {
            asset_id: "asset_pdf_1",
            preview_url: "https://fake-r2.test/file-preview.pdf",
            preview_expires_at: "2026-05-26T13:15:00Z",
            download_url: "https://fake-r2.test/file.pdf",
            download_expires_at: "2026-05-26T14:00:00Z",
            thumbnail_url: null,
            thumbnail_status: "pending",
            thumbnail_expires_at: null,
            content_type: "application/pdf",
            original_filename: "pump-datasheet.pdf",
            display_name: "Pump datasheet",
            size_bytes: 512,
          },
        ],
      });
    }
    return jsonResponse({ items: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
    renderWithQueryClient(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        projectId="proj_1"
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
    renderWithQueryClient(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("P-1"));
    await user.keyboard("{Control>}a{/Control}P-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildSlice([buildPump({ datasheet_asset_ids: ["asset_pdf_1"] })]);
    const fieldDefs = pumpsTableFieldDefs(slice);
    const tableSchema: TableSchema = {
      fieldDefs,
      customFields: [],
      coreFieldKeys: new Set(fieldDefs.map((field) => field.field_key)),
      schemaFingerprint: "test",
      mintCustomFieldId: () => "cf_test",
    };
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const attachment = await screen.findByTitle("pump-datasheet.pdf · application/pdf");
    const attachmentCell = attachment.closest(".attachment-cell");
    expect(attachmentCell).not.toBeNull();
    fireEvent.keyDown(attachmentCell as HTMLElement, { key: "Delete" });

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "pmp_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});
