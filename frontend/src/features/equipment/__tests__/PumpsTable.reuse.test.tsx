import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createQueryClient } from "../../../app/query-client";
import { emptyViewState } from "../../../shared/ui/data-table";
import { PumpsTable } from "../components/PumpsTable";
import { buildPump, buildPumpsSlice, schemaForPumps } from "../testing/testFixtures";

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

describe("PumpsTable DataTable reuse", () => {
  test("renders fixed pump columns and single-select labels", () => {
    const slice = buildPumpsSlice({ pumps: [buildPump()] });
    const tableSchema = schemaForPumps(slice);
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

    expect(screen.getByRole("columnheader", { name: /Record-ID/ })).toBeInTheDocument();
    expect(screen.getByText("P-1")).toBeInTheDocument();
    expect(screen.getByText("Circulator")).toBeInTheDocument();
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildPumpsSlice({ pumps: [buildPump()] });
    const tableSchema = schemaForPumps(slice);
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

  test("keeps phase validation local so other cells remain editable", async () => {
    const user = userEvent.setup();
    const slice = buildPumpsSlice({
      pumps: [buildPump({ custom_values: { ...buildPump().custom_values, manufacturer: "This" } })],
    });
    const tableSchema = schemaForPumps(slice);
    const onWrite = vi
      .fn()
      .mockRejectedValueOnce(new Error("Phase must be 1 or 3."))
      .mockResolvedValue(undefined);
    const { container } = renderWithQueryClient(
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

    const phaseCell = container.querySelector<HTMLElement>(
      'td[data-row-id="pmp_1"][data-field-key="phase"]',
    );
    expect(phaseCell).not.toBeNull();
    await user.dblClick(phaseCell!);
    await user.keyboard("{Control>}a{/Control}5{Enter}");

    await waitFor(() => {
      expect(phaseCell).toHaveAttribute("data-cell-error", "true");
    });
    expect(phaseCell).toHaveAttribute("title", "Phase must be 1 or 3.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    const manufacturerCell = container.querySelector<HTMLElement>(
      'td[data-row-id="pmp_1"][data-field-key="manufacturer"]',
    );
    expect(manufacturerCell).not.toBeNull();
    await user.dblClick(manufacturerCell!);
    await user.keyboard("{Control>}a{/Control}That{Enter}");

    await waitFor(() => {
      expect(onWrite).toHaveBeenLastCalledWith({
        kind: "cell",
        writes: [{ rowId: "pmp_1", fieldKey: "manufacturer", value: "That" }],
      });
    });
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildPumpsSlice({ pumps: [buildPump({ datasheet_asset_ids: ["asset_pdf_1"] })] });
    const tableSchema = schemaForPumps(slice);
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
