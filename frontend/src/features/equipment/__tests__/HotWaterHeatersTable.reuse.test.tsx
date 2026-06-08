import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState, type DataTableProps } from "../../../shared/ui/data-table";
import { HotWaterHeatersTable } from "../components/HotWaterHeatersTable";
import {
  buildHotWaterHeater,
  buildHotWaterHeatersSlice,
  schemaForHotWaterHeaters,
} from "../testing/testFixtures";
import type { HotWaterHeaterRow } from "../types";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
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
            original_filename: "hwh-datasheet.pdf",
            display_name: "Heater datasheet",
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

function renderTable({
  onWrite = vi.fn(),
  hotWaterHeater = buildHotWaterHeater(),
}: {
  onWrite?: NonNullable<DataTableProps<HotWaterHeaterRow>["onWrite"]>;
  hotWaterHeater?: HotWaterHeaterRow;
} = {}) {
  const slice = buildHotWaterHeatersSlice({ hot_water_heaters: [hotWaterHeater] });
  renderWithQueryClient(
    <HotWaterHeatersTable
      hotWaterHeatersSlice={slice}
      tableSchema={schemaForHotWaterHeaters(slice)}
      isEditor
      projectId={PROJECT_ID}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={onWrite}
    />,
  );
  return { onWrite };
}

describe("HotWaterHeatersTable DataTable reuse", () => {
  test("renders the requested columns, defaults, type label, and unit-backed fields", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Quantity/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Type/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Model/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Manufacturer/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Size/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Temperatur/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /UEF/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Datasheet/ })).toBeInTheDocument();
    expect(screen.getByText("5-Heat Pump (Annual COP)")).toBeInTheDocument();
    expect(document.querySelector('[data-field-key="quantity"]')).toHaveTextContent("1");
    expect(document.querySelector('[data-field-key="power_factor"]')).toHaveTextContent("0.8");
    expect(screen.getByRole("gridcell", { name: "302.8" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "60.0" })).toBeInTheDocument();
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const { onWrite } = renderTable();
    const row = screen.getByRole("row", { name: /HWH-1/ });

    await user.dblClick(within(row).getByRole("gridcell", { name: "DHW heater" }));
    await user.keyboard("{Control>}a{/Control}DHW buffer heater{Enter}");

    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "hwh_1", fieldKey: "name", value: "DHW buffer heater" }],
    });
  });

  test("datasheet delete emits a cell write", async () => {
    const { onWrite } = renderTable({
      hotWaterHeater: buildHotWaterHeater({ datasheet_asset_ids: ["asset_pdf_1"] }),
    });

    const attachment = await screen.findByTitle("hwh-datasheet.pdf · application/pdf");
    const attachmentCell = attachment.closest(".attachment-cell");
    expect(attachmentCell).not.toBeNull();
    fireEvent.keyDown(attachmentCell as HTMLElement, { key: "Delete" });

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "hwh_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});
