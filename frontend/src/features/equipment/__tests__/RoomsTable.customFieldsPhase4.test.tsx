import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EquipmentTab } from "../routes/EquipmentTab";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  ROOMS_TABLE_NAME,
  type RoomRow,
  type RoomsSlice,
} from "../types";
import type { ProjectDetail } from "../../projects/types";

// Plan-17 P4.10 — exit-criteria acceptance tests for formula custom
// fields, exercised through the rendered EquipmentTab UI. Pairs with
// the isolation coverage in
// `frontend/src/shared/ui/data-table/__tests__/FormulaEditorPopover.test.tsx`
// and the backend round-trip coverage in
// `backend/tests/test_project_document_custom_fields_phase_4.py`.

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

const LABEL_FORMULA_SOURCE = 'concat({Number}, " — ", upper({Name}))';

function buildFormulaField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_label",
    field_key: null,
    display_name: "Label",
    field_type: "formula",
    config: {
      source: LABEL_FORMULA_SOURCE,
      ast: null,
      deps: ["number", "name"],
      result_type: "text",
    },
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
    rows_computed: {},
    single_select_options: {
      [ROOM_FLOOR_LEVEL_KEY]: [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      [ROOM_BUILDING_ZONE_KEY]: [],
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

type SchemaMutationBody = {
  kind: string;
  after?: CustomFieldDef;
  fieldId?: string;
  displayName?: string;
  sourceFieldId?: string;
  description?: string | null;
  source?: string;
};

const ROOMS_CORE_DISPLAY_NAMES = new Set([
  "Number",
  "Name",
  "Floor",
  "Zone",
  "People",
  "Bedrooms",
  "iCFA",
  "ERVs",
]);

// Test fake — verifies UI plumbing only. The real evaluator's
// semantics are covered by the parity corpus tests (plan-17 P4.7);
// coupling this UI test to it would conflate concerns.
function simulateFormula(
  source: string,
  room: RoomRow,
  customByFieldId: Record<string, CustomFieldDef>,
): unknown {
  const refs = [...source.matchAll(/\{([^}]+)\}/g)]
    .map((m) => m[1])
    .filter((ref): ref is string => typeof ref === "string");
  const knownCustomDisplayNames = new Set(Object.values(customByFieldId).map((f) => f.display_name));
  for (const ref of refs) {
    if (!ROOMS_CORE_DISPLAY_NAMES.has(ref) && !knownCustomDisplayNames.has(ref)) {
      return { error: "missing_ref" };
    }
  }
  if (source === LABEL_FORMULA_SOURCE) {
    return `${room.number} — ${room.name.toUpperCase()}`;
  }
  if (source === 'concat({Tag}, "-", {Name})') {
    const tagFieldId = Object.entries(customByFieldId).find(
      ([, def]) => def.display_name === "Tag",
    )?.[0];
    const tag = tagFieldId ? String(room.custom[tagFieldId] ?? "") : "";
    return `${tag}-${room.name}`;
  }
  return null;
}

function applySchemaMutation(
  slice: RoomsSlice,
  mutation: SchemaMutationBody,
  nextDraftEtag: string,
): RoomsSlice {
  let customFields = slice.custom_fields.map((field) => ({
    ...field,
    config: { ...field.config },
  }));
  let rooms = slice.rooms;
  if (mutation.kind === "addField" && mutation.after) {
    customFields.push({ ...mutation.after, config: { ...mutation.after.config } });
  } else if (mutation.kind === "duplicateField" && mutation.after) {
    const sourceIndex = customFields.findIndex((item) => item.id === mutation.sourceFieldId);
    customFields.splice(sourceIndex + 1, 0, {
      ...mutation.after,
      config: { ...mutation.after.config },
    });
  } else if (mutation.kind === "deleteField") {
    const fieldId = mutation.fieldId ?? "";
    customFields = customFields.filter((item) => item.id !== fieldId);
    rooms = slice.rooms.map((row) => {
      const custom = { ...row.custom };
      delete custom[fieldId];
      return { ...row, custom };
    });
  }
  const rowsComputed: Record<string, Record<string, unknown>> = {};
  const customByFieldId = Object.fromEntries(customFields.map((f) => [f.id, f]));
  for (const row of rooms) {
    const per: Record<string, unknown> = {};
    for (const field of customFields) {
      if (field.field_type !== "formula") continue;
      const source = String(field.config.source ?? "");
      per[field.id] = simulateFormula(source, row, customByFieldId);
    }
    if (Object.keys(per).length > 0) rowsComputed[row.id] = per;
  }
  return {
    ...slice,
    source: "draft",
    draft_etag: nextDraftEtag,
    custom_fields: customFields,
    rooms,
    rows_computed: rowsComputed,
  };
}

function renderEquipmentTab(initialSlice: RoomsSlice) {
  let current = initialSlice;
  let draftCounter = 0;
  const postBodies: SchemaMutationBody[] = [];

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}/custom-fields:mutate`)) {
      const mutation = JSON.parse(String(init?.body)) as SchemaMutationBody;
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
    throw new Error(`Unhandled fetch in phase-4 acceptance test: ${url}`);
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <EquipmentTab project={buildProject()} />
    </QueryClientProvider>,
  );
  return { ...rendered, postBodies };
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

async function openHeaderMenu(headerLabel: string) {
  const header = await findColumnHeaderByLabel(headerLabel);
  fireEvent.contextMenu(header, { clientX: 100, clientY: 50 });
  return screen.findByRole("menu");
}

describe("RoomsTable custom-fields Phase 4 — formula acceptance through rendered UI", () => {
  test("adding a formula via popover dispatches the wire shape and surfaces computed values in the grid", async () => {
    const { postBodies } = renderEquipmentTab(buildSlice());

    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());

    fireEvent.click(await screen.findByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    fireEvent.change(within(dialog).getByLabelText("Field name"), { target: { value: "Label" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Formula" }));
    fireEvent.change(within(dialog).getByLabelText("Expression"), {
      target: { value: LABEL_FORMULA_SOURCE },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));

    expect(
      await screen.findByRole("columnheader", { name: /^Label\b/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    expect(postBodies).toHaveLength(1);
    const add = postBodies[0]!;
    expect(add.kind).toBe("addField");
    expect(add.after?.field_type).toBe("formula");
    const config = (add.after?.config ?? {}) as Record<string, unknown>;
    expect(config.source).toBe(LABEL_FORMULA_SOURCE);
    expect(config.deps).toEqual(expect.arrayContaining(["number", "name"]));
    expect(config.ast).toBeTruthy();
  });

  test("the header context menu exposes Edit formula… on formula custom fields and the popover seeds the stored source", async () => {
    const seeded = buildSlice({
      custom_fields: [buildFormulaField()],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
    });

    renderEquipmentTab(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    await openHeaderMenu("Label");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit formula…" }));

    const editDialog = await screen.findByRole("dialog", { name: /Edit formula for Label/ });
    const expression = within(editDialog).getByLabelText("Expression") as HTMLInputElement;
    expect(expression.value).toBe(LABEL_FORMULA_SOURCE);

    fireEvent.keyDown(editDialog, { key: "Escape" });
    await openHeaderMenu("Name");
    expect(screen.queryByRole("menuitem", { name: "Edit formula…" })).toBeNull();
  });

  test("duplicating a formula via the header context menu dispatches duplicateField and the duplicate column renders the same computed value", async () => {
    const seeded = buildSlice({
      custom_fields: [buildFormulaField()],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
    });

    const { postBodies } = renderEquipmentTab(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    await openHeaderMenu("Label");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate field" }));
    expect(
      await screen.findByRole("columnheader", { name: /^Label copy\b/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText("101 — LIVING ROOM").length).toBeGreaterThanOrEqual(2),
    );

    expect(postBodies).toHaveLength(1);
    const dup = postBodies[0]!;
    expect(dup.kind).toBe("duplicateField");
    expect(dup.sourceFieldId).toBe("cf_label");
    expect(dup.after?.field_type).toBe("formula");
  });

  test("deleting a referenced custom field surfaces the missing_ref error overlay on the formula column", async () => {
    const tag: CustomFieldDef = {
      id: "cf_tag",
      field_key: null,
      display_name: "Tag",
      field_type: "short_text",
      config: {},
      description: null,
      created_at: "2026-05-24T12:00:00Z",
      created_by: null,
    };
    const formula = buildFormulaField({
      config: {
        source: 'concat({Tag}, "-", {Name})',
        ast: null,
        deps: ["cf_tag", "name"],
        result_type: "text",
      },
    });
    const seeded = buildSlice({
      rooms: [buildRoom({ custom: { cf_tag: "blue" } })],
      custom_fields: [tag, formula],
      rows_computed: { rm_1: { cf_label: "blue-Living Room" } },
    });

    const { postBodies } = renderEquipmentTab(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("blue-Living Room")).toBeInTheDocument();

    await openHeaderMenu("Tag");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete field" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete field" }));

    await waitFor(() =>
      expect(screen.queryByRole("columnheader", { name: /^Tag\b/ })).toBeNull(),
    );
    // <ComputedCell> encodes the structured `missing_ref` overlay as an
    // aria-labelled #ERROR glyph; the wire copy is pinned here.
    expect(
      await screen.findByLabelText(/Formula error: Formula references a field that no longer exists/),
    ).toBeInTheDocument();

    expect(postBodies.map((b) => b.kind)).toEqual(["deleteField"]);
  });

  test("viewer mode renders computed values and suppresses every formula-editor affordance", () => {
    const slice = buildSlice({
      custom_fields: [buildFormulaField()],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
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
        rowsComputed={slice.rows_computed}
      />,
    );

    expect(screen.getByText("101 — LIVING ROOM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
    const labelHeader = screen.getByRole("columnheader", { name: /^Label\b/ });
    fireEvent.contextMenu(labelHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Edit formula…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete field" })).toBeNull();
  });
});
