import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RoomsPage } from "../routes/RoomsPage";
import { RoomsTable } from "../components/RoomsTable";
import { renderHook } from "@testing-library/react";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import type { ProjectDetail } from "../../projects/types";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

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

function buildCustomField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_paint",
    field_key: null,
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    created_at: "2026-05-24T12:00:00Z",
    created_by: null,
    ...overrides,
  };
}

function buildRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "rm_1",
    number: "101",
    name: "Living Room",
    floor_level: "opt_ground",
    building_zone: null,
    num_people: 0,
    num_bedrooms: 0,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
    custom: {},
    ...overrides,
  };
}

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return {
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag-0",
    rooms: [buildRoom()],
    custom_fields: [],
    single_select_options: {
      "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      "rooms.building_zone": [],
    },
    ...overrides,
  };
}

function schemaFor(slice: RoomsSlice): TableSchema {
  return renderHook(() =>
    useTableSchema({
      tableKey: ROOMS_TABLE_NAME,
      coreFieldDefs: roomsTableFieldDefs(slice),
      customFields: slice.custom_fields,
    }),
  ).result.current;
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
  const postBodies: unknown[] = [];

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}/custom-fields:mutate`)) {
      const mutation = JSON.parse(String(init?.body));
      postBodies.push(mutation);
      current = applySchemaMutation(current, mutation, `d-etag-${++draftCounter}`);
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

type SchemaMutationBody = {
  kind: string;
  after?: CustomFieldDef;
  fieldId?: string;
  displayName?: string;
  sourceFieldId?: string;
  description?: string | null;
};

function applySchemaMutation(
  slice: RoomsSlice,
  mutation: SchemaMutationBody,
  nextDraftEtag: string,
): RoomsSlice {
  const customFields = slice.custom_fields.map((field) => ({
    ...field,
    config: { ...field.config },
  }));
  if (mutation.kind === "addField") {
    if (mutation.after)
      customFields.push({ ...mutation.after, config: { ...mutation.after.config } });
  } else if (mutation.kind === "editFieldBundle") {
    const index = customFields.findIndex((item) => item.id === mutation.fieldId);
    if (index >= 0 && mutation.after) {
      customFields[index] = { ...mutation.after, config: { ...mutation.after.config } };
    }
  } else if (mutation.kind === "renameField") {
    const field = customFields.find((item) => item.id === mutation.fieldId);
    if (field && mutation.displayName) field.display_name = mutation.displayName;
  } else if (mutation.kind === "duplicateField") {
    const sourceIndex = customFields.findIndex((item) => item.id === mutation.sourceFieldId);
    if (mutation.after) customFields.splice(sourceIndex + 1, 0, mutation.after);
  } else if (mutation.kind === "setDescription") {
    const field = customFields.find((item) => item.id === mutation.fieldId);
    if (field) field.description = mutation.description ?? null;
  } else if (mutation.kind === "deleteField") {
    const fieldId = mutation.fieldId ?? "";
    const nextFields = customFields.filter((item) => item.id !== mutation.fieldId);
    return {
      ...slice,
      source: "draft",
      draft_etag: nextDraftEtag,
      custom_fields: nextFields,
      rooms: slice.rooms.map((row) => {
        const custom = { ...row.custom };
        delete custom[fieldId];
        return { ...row, custom };
      }),
    };
  }
  return { ...slice, source: "draft", draft_etag: nextDraftEtag, custom_fields: customFields };
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
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField({ description: "Read-only description" })],
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
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
