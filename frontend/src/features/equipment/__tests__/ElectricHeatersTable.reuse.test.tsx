import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState } from "../../../shared/ui/data-table";
import { ElectricHeatersTable } from "../components/ElectricHeatersTable";
import {
  buildElectricHeater,
  buildElectricHeatersSlice,
  schemaForElectricHeaters,
} from "../testing/testFixtures";

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
            preview_url: "https://fake-r2.test/electric-heater-preview.pdf",
            preview_expires_at: "2026-05-26T13:15:00Z",
            download_url: "https://fake-r2.test/electric-heater.pdf",
            download_expires_at: "2026-05-26T14:00:00Z",
            thumbnail_url: null,
            thumbnail_status: "pending",
            thumbnail_expires_at: null,
            content_type: "application/pdf",
            original_filename: "electric-heater-datasheet.pdf",
            display_name: "Electric heater datasheet",
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

describe("ElectricHeatersTable DataTable reuse", () => {
  test("renders requested columns and URL values", () => {
    const slice = buildElectricHeatersSlice({
      electric_heaters: [
        buildElectricHeater({
          url: "https://example.com/heater.pdf",
          notes: "Basis of design.",
        }),
      ],
    });

    renderWithQueryClient(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={() => undefined}
      />,
    );

    for (const label of [
      "Tag",
      "Name",
      "Model",
      "Manufacturer",
      "Watt",
      "URL",
      "Notes",
      "Datasheet",
    ]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "example.com/heater.pdf" })).toHaveAttribute(
      "href",
      "https://example.com/heater.pdf",
    );
  });

  test("commits inline edits through DataTable writes", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    const slice = buildElectricHeatersSlice({
      electric_heaters: [buildElectricHeater({ id: "heatr_1" })],
    });

    renderWithQueryClient(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const wattCell = document.querySelector('[data-field-key="watt"]');
    expect(wattCell).not.toBeNull();
    await user.dblClick(wattCell as HTMLElement);
    const input = within(wattCell as HTMLElement).getByRole("textbox");
    await user.clear(input);
    await user.type(input, "1250");
    await user.keyboard("{Enter}");

    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "heatr_1", fieldKey: "watt", value: 1250 }],
    });
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildElectricHeatersSlice({
      electric_heaters: [buildElectricHeater({ datasheet_asset_ids: ["asset_pdf_1"] })],
    });
    const onWrite = vi.fn().mockResolvedValue(undefined);

    renderWithQueryClient(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const attachment = await screen.findByTitle("electric-heater-datasheet.pdf · application/pdf");
    fireEvent.click(attachment);
    fireEvent.click(await screen.findByRole("button", { name: "Detach" }));

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "heatr_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});
