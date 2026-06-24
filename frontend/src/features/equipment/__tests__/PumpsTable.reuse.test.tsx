import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { createQueryClient } from "../../../app/query-client";
import { spacesRoomsPath } from "../../spaces/paths";
import { emptyViewState } from "../../../shared/ui/data-table";
import { PumpsTable } from "../components/PumpsTable";
import { routeForInverseSource } from "../lib/inverseRoutes";
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

    expect(screen.getByRole("columnheader", { name: /Display Name/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByText("P-1")).toBeInTheDocument();
    expect(screen.getByText("6-DHW Circulation Pump")).toBeInTheDocument();
  });

  test("renders the built-in Status column as a single-select pill", () => {
    const slice = buildPumpsSlice({ pumps: [buildPump()] });
    const tableSchema = schemaForPumps(slice);
    const { container } = renderWithQueryClient(
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

    expect(screen.getByRole("columnheader", { name: /Status/ })).toBeInTheDocument();
    // Seeded fixture rows default to Needed; the colored option pill renders.
    expect(screen.getByText("Needed")).toBeInTheDocument();
    const statusCell = container.querySelector<HTMLElement>(
      'td[data-row-id="pmp_1"][data-field-key="status"]',
    );
    expect(statusCell).not.toBeNull();
  });

  test("exposes Status as an editable (non-locked) single-select field", () => {
    const slice = buildPumpsSlice({ pumps: [buildPump()] });
    const tableSchema = schemaForPumps(slice);
    const statusField = tableSchema.fieldDefs.find((field) => field.field_key === "status");

    expect(statusField?.field_type).toBe("single_select");
    expect(statusField?.read_only).not.toBe(true);
    // The value cell stays editable even though the option list is fixed;
    // a fully read-only field would carry `read_only: true`.
    expect(statusField?.options?.length).toBe(4);
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

  test("renders read-only inverse link columns and forwards pill clicks", async () => {
    const user = userEvent.setup();
    const slice = buildPumpsSlice({
      pumps: [buildPump({ id: "pmp_a" })],
      inverse_link_fields: [
        {
          source_key: "rooms.cf_pumps",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "cf_pumps",
          source_field_display_name: "Pump",
        },
      ],
      inverse_links: {
        pmp_a: {
          "rooms.cf_pumps": ["rm_a", "rm_b"],
        },
      },
    });
    const tableSchema = schemaForPumps(slice);
    const onInversePillClick = vi.fn();

    renderWithQueryClient(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        onInversePillClick={onInversePillClick}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Rooms ← Pump/ })).toBeInTheDocument();
    // The first click activates the grid cell; the second opens the linked row.
    await user.click(screen.getByRole("button", { name: "rm_a" }));
    await user.click(screen.getByRole("button", { name: "rm_a" }));

    expect(onInversePillClick).toHaveBeenCalledWith(
      expect.objectContaining({ source_key: "rooms.cf_pumps" }),
      "rm_a",
    );
  });

  test("shows the shared add affordance for editable inverse Rooms links", async () => {
    const user = userEvent.setup();
    const slice = buildPumpsSlice({
      pumps: [buildPump({ id: "pmp_a" })],
      inverse_link_fields: [
        {
          source_key: "rooms.cf_pumps",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "cf_pumps",
          source_field_display_name: "Pump",
        },
      ],
      inverse_links: {
        pmp_a: {
          "rooms.cf_pumps": [],
        },
      },
    });
    const tableSchema = schemaForPumps(slice);
    const onInverseLinkEdit = vi.fn();
    const { container } = renderWithQueryClient(
      <PumpsTable
        pumpsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        onInverseLinkEdit={onInverseLinkEdit}
      />,
    );

    await user.click(getGridCell(container, "pmp_a", "inverse:rooms.cf_pumps"));
    await user.click(screen.getByRole("button", { name: "Add linked record" }));

    expect(onInverseLinkEdit).toHaveBeenCalledWith(
      expect.objectContaining({ source_key: "rooms.cf_pumps" }),
      slice.pumps[0],
    );
  });

  test("routes inverse-link source pills from their declared table path", () => {
    expect(
      routeForInverseSource(
        "proj_1",
        {
          source_key: "rooms.cf_pumps",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "cf_pumps",
          source_field_display_name: "Pump",
        },
        "rm_a",
      ),
    ).toBe(`${spacesRoomsPath("proj_1")}?focus=rm_a`);

    expect(
      routeForInverseSource(
        "proj_1",
        {
          source_key: "rooms.cf_pumps",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "cf_pumps",
          source_field_display_name: "Pump",
        },
        "rm_a",
        { openRoom: true },
      ),
    ).toBe(`${spacesRoomsPath("proj_1")}?focus=rm_a&open=1`);

    expect(
      routeForInverseSource(
        "proj_1",
        {
          source_key: "equipment.hot_water_heaters.cf_pumps",
          source_table_path: ["equipment", "hot_water_heaters"],
          source_table_display: "Hot Water Heaters",
          source_field_key: "cf_pumps",
          source_field_display_name: "Pump",
        },
        "hwh_a",
      ),
    ).toBe("/projects/proj_1/equipment?tab=hot-water-heaters&focus=hwh_a");
  });
});

function getGridCell(container: HTMLElement, rowId: string, fieldKey: string): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `td[data-row-id="${rowId}"][data-field-key="${fieldKey}"]`,
  );
  if (!cell) throw new Error(`Expected grid cell ${rowId}/${fieldKey}.`);
  return cell;
}
