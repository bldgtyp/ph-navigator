import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RoomsPage } from "../routes/RoomsPage";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState } from "../../../shared/ui/data-table";
import type { ProjectDetail } from "../../projects/types";
import { ROOMS_TABLE_NAME, type RoomsSlice } from "../types";
import {
  applyRoomsSchemaMutationFixture,
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  schemaForRooms,
  withRoomCustomValues,
  type RoomsSchemaMutationFixture,
} from "../testing/testFixtures";

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const VERSION_ID = "00000000-0000-0000-0000-000000000002";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function buildProject(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  const version = {
    id: VERSION_ID,
    project_id: PROJECT_ID,
    name: "Working",
    kind: "working" as const,
    locked: false,
    schema_version: 2,
    body_size_bytes: 1,
    created_at: "2026-05-24T12:00:00Z",
    updated_at: "2026-05-24T12:00:00Z",
  };
  return {
    id: PROJECT_ID,
    name: "West Stockbridge House",
    bt_number: "2426",
    client: "May",
    cert_programs: ["phi"],
    phius_number: null,
    phius_dropbox_url: null,
    active_version_id: VERSION_ID,
    last_saved_at: null,
    created_at: "2026-05-24T12:00:00Z",
    updated_at: "2026-05-24T12:00:00Z",
    versions: [version],
    active_version: version,
    access_mode: "editor",
    owner_display_name: "Ed May",
    ...overrides,
  };
}

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return buildRoomsSlice({
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    draft_etag: "d-etag-0",
    rooms: [buildRoom()],
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderRoomsPageWithMockedSchemaMutation(initialSlice: RoomsSlice) {
  let current = initialSlice;
  let draftCounter = 0;
  const postBodies: RoomsSchemaMutationFixture[] = [];

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}/custom-fields:mutate`)) {
      const mutation = JSON.parse(String(init?.body)) as RoomsSchemaMutationFixture;
      postBodies.push(mutation);
      current = applyRoomsSchemaMutationFixture(current, mutation, `d-etag-${++draftCounter}`);
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
    throw new Error(`Unhandled fetch in custom-field editor test: ${url}`);
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RoomsPage project={buildProject()} />
    </QueryClientProvider>,
  );
  return { ...rendered, postBodies };
}

async function addField(displayName: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Add field" }));
  const dialog = await screen.findByRole("dialog", { name: "Add field" });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: displayName },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));
}

async function openHeaderMenu(headerLabel: string) {
  const header = await findColumnHeaderByLabel(headerLabel);
  fireEvent.contextMenu(header, { clientX: 100, clientY: 50 });
  return screen.findByRole("menu");
}

async function findColumnHeaderByLabel(label: string): Promise<HTMLElement> {
  let match: HTMLElement | undefined;
  await waitFor(() => {
    const headers = screen.getAllByRole("columnheader");
    match = headers.find(
      (header) => header.querySelector(".data-table-header-label")?.textContent === label,
    );
    expect(match).toBeDefined();
  });
  return match as HTMLElement;
}

describe("RoomsTable custom-field editor E2E acceptance", () => {
  test("add → rename → duplicate → delete dispatches schema POSTs through RoomsPage", async () => {
    const { postBodies } = renderRoomsPageWithMockedSchemaMutation(buildSlice());

    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());

    await addField("Paint");
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /^Paint\b/ })).toBeVisible(),
    );

    await openHeaderMenu("Paint");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "  Finish  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /^Finish\b/ })).toBeVisible(),
    );

    await openHeaderMenu("Finish");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate field" }));
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /^Finish copy\b/ })).toBeVisible(),
    );

    await openHeaderMenu("Finish copy");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete field" }));
    const deleteDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete field" }));
    await waitFor(() =>
      expect(screen.queryByRole("columnheader", { name: /^Finish copy\b/ })).toBeNull(),
    );

    expect(postBodies.map((body) => (body as { kind: string }).kind)).toEqual([
      "addField",
      "editFieldBundle",
      "duplicateField",
      "deleteField",
    ]);
    expect(postBodies).toHaveLength(4);
    expect(postBodies[0]).toMatchObject({
      kind: "addField",
      tableKey: ROOMS_TABLE_NAME,
      after: { display_name: "Paint", field_type: "short_text" },
    });
    expect(postBodies[1]).toMatchObject({
      kind: "editFieldBundle",
      tableKey: ROOMS_TABLE_NAME,
      after: { display_name: "Finish" },
    });
    expect(postBodies[2]).toMatchObject({
      kind: "duplicateField",
      tableKey: ROOMS_TABLE_NAME,
      after: { display_name: "Finish copy" },
    });
    expect(postBodies[3]).toMatchObject({
      kind: "deleteField",
      tableKey: ROOMS_TABLE_NAME,
      clearValues: true,
    });
  });

  test("viewer mode shows read affordances and suppresses schema mutation controls", () => {
    const slice = buildSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: [
        ...buildSlice().field_defs,
        buildCustomField({ description: "Read-only description" }),
      ],
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
        isEditor={false}
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );

    const nameHeader = screen.getByRole("columnheader", { name: /^Name\b/ });
    expect(within(nameHeader).getByTestId("data-table-header-lock")).toBeInTheDocument();
    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    expect(
      within(paintHeader).getByRole("button", { name: "Description for Paint" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();

    fireEvent.contextMenu(paintHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Rename field" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete field" })).toBeNull();
  });
});
