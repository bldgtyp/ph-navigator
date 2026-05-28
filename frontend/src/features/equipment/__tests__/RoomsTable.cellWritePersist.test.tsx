import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RoomsPage } from "../routes/RoomsPage";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";
import type { TableFieldDef } from "../../../shared/ui/data-table";
import type { ProjectDetail } from "../../projects/types";
import {
  applyRoomsSchemaMutationFixture,
  buildRoom,
  buildRoomsSlice,
  type RoomsSchemaMutationFixture,
} from "../testing/testFixtures";

// Reproduces the "value disappears on Enter after adding a custom
// field" regression: the user creates a custom field, types into a
// cell of the empty new column, hits Enter, and the typed value is
// lost. Wires a stateful mock backend so the cell-write PUT actually
// applies the payload and reflects it in subsequent reads — this is
// what the unit-level RoomsTable.customFieldCellWrite test does NOT
// cover.

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return buildRoomsSlice({
    draft_etag: "d-etag-0",
    rooms: [buildRoom()],
    rows_computed: {},
    ...overrides,
  });
}

function buildProject(): ProjectDetail {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Test Project",
    address: null,
    description: null,
    access_mode: "editor",
    active_version_id: "00000000-0000-0000-0000-000000000002",
    active_version: { id: "00000000-0000-0000-0000-000000000002", label: "v1", locked: false },
    versions: [{ id: "00000000-0000-0000-0000-000000000002", label: "v1", locked: false }],
    last_loaded_at: null,
  } as unknown as ProjectDetail;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithStatefulBackend(initialSlice: RoomsSlice) {
  let current = initialSlice;
  let draftCounter = 0;
  const requestLog: Array<{ url: string; method: string; body: unknown }> = [];

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const rawBody = init?.body ? String(init.body) : "";
    const parsedBody = rawBody ? JSON.parse(rawBody) : null;
    requestLog.push({ url, method, body: parsedBody });

    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}/custom-fields:mutate`)) {
      const mutation = parsedBody as RoomsSchemaMutationFixture;
      current = applyRoomsSchemaMutationFixture(current, mutation, `d-etag-${++draftCounter}`);
      return jsonResponse(current);
    }

    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}`) && method === "PUT") {
      const payload = parsedBody as {
        rooms: RoomRow[];
        single_select_options: RoomsSlice["single_select_options"];
        field_defs?: TableFieldDef[];
      };
      current = {
        ...current,
        source: "draft",
        draft_etag: `d-etag-${++draftCounter}`,
        rooms: payload.rooms,
        single_select_options: payload.single_select_options,
        field_defs: payload.field_defs ?? current.field_defs,
      };
      return jsonResponse(current);
    }

    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}`)) {
      return jsonResponse(current);
    }

    if (url.includes(`/table-views/${ROOMS_TABLE_NAME}`)) {
      return jsonResponse({
        view_state_schema_version: 1,
        view_state: null,
        updated_at: null,
      });
    }

    if (url.includes("/draft")) {
      return jsonResponse({});
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RoomsPage project={buildProject()} />
    </QueryClientProvider>,
  );
  return { ...rendered, requestLog, getCurrent: () => current };
}

describe("RoomsTable cell-write persistence (regression)", () => {
  test("typing into an empty cf_* cell preserves the value across the PUT round-trip", async () => {
    const initial = buildSlice();
    const { requestLog, getCurrent } = renderWithStatefulBackend(initial);

    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());

    fireEvent.click(await screen.findByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Notes" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: /Notes/ })).toBeInTheDocument();
    });

    const customFields = getCurrent().field_defs.filter((field) => field.origin === "custom");
    expect(customFields).toHaveLength(1);
    const cfId = customFields[0]!.field_key;

    const cells = document.querySelectorAll(`[data-field-key="${cfId}"]`);
    expect(cells.length).toBeGreaterThan(0);
    const targetCell = cells[0] as HTMLElement;
    fireEvent.doubleClick(targetCell);

    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "hello" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => {
      const putRequest = requestLog.find(
        (req) =>
          req.method === "PUT" &&
          req.url.includes(`/draft/tables/${ROOMS_TABLE_NAME}`) &&
          !req.url.includes("custom-fields"),
      );
      expect(putRequest).toBeDefined();
    });

    const putRequest = requestLog.find(
      (req) =>
        req.method === "PUT" &&
        req.url.includes(`/draft/tables/${ROOMS_TABLE_NAME}`) &&
        !req.url.includes("custom-fields"),
    )!;
    const payload = putRequest.body as { rooms: RoomRow[] };
    expect(payload.rooms[0]?.custom_values[cfId]).toBe("hello");
    expect(getCurrent().rooms[0]?.custom_values[cfId]).toBe("hello");

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });
});
