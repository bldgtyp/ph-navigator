import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState } from "../../../shared/ui/data-table";
import { FansTable } from "../components/FansTable";
import { buildFan, buildFansSlice, schemaForFans } from "../testing/testFixtures";

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
            original_filename: "fan-datasheet.pdf",
            display_name: "Fan datasheet",
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

describe("FansTable DataTable reuse", () => {
  test("renders AirTable-matched fan columns, defaults, units, and single-select labels", () => {
    const slice = buildFansSlice({ fans: [buildFan()] });
    const tableSchema = schemaForFans(slice);
    renderWithQueryClient(
      <FansTable
        fansSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Quantity/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Annual Runtime/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Power Factor/ })).toBeInTheDocument();
    expect(screen.getByText("m3/h")).toBeInTheDocument();
    expect(screen.getByText("F-1")).toBeInTheDocument();
    expect(screen.getByText("2-Kitchen Hood")).toBeInTheDocument();
    expect(
      document.querySelector('[data-row-id="fan_1"][data-field-key="power_factor"]'),
    ).toHaveTextContent("0.8");
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildFansSlice({ fans: [buildFan()] });
    const tableSchema = schemaForFans(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <FansTable
        fansSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("F-1"));
    await user.keyboard("{Control>}a{/Control}F-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildFansSlice({ fans: [buildFan({ datasheet_asset_ids: ["asset_pdf_1"] })] });
    const tableSchema = schemaForFans(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <FansTable
        fansSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const attachment = await screen.findByTitle("fan-datasheet.pdf · application/pdf");
    fireEvent.click(attachment);
    fireEvent.click(await screen.findByRole("button", { name: "Detach" }));

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "fan_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});
