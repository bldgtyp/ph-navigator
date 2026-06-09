import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { RoomsPage } from "../routes/RoomsPage";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState, type TableFieldDef } from "../../../shared/ui/data-table";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";
import type { ProjectDetail } from "../../projects/types";
import {
  applyRoomsSchemaMutationFixture,
  buildFormulaField,
  buildRoom,
  buildRoomsSlice,
  schemaForRooms,
  withRoomCustomValues,
  type RoomsSchemaMutationFixture,
} from "../testing/testFixtures";

// Plan-17 P4.10 — exit-criteria acceptance tests for formula custom
// fields, exercised through the rendered RoomsPage UI. Pairs with
// the isolation coverage in FieldConfigModal's formula section and the backend round-trip coverage in
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

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return buildRoomsSlice({
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    draft_etag: "d-etag-0",
    rooms: [buildRoom()],
    rows_computed: {},
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
  customByFieldId: Record<string, TableFieldDef>,
): unknown {
  const refs = [...source.matchAll(/\{([^}]+)\}/g)]
    .map((m) => m[1])
    .filter((ref): ref is string => typeof ref === "string");
  const knownCustomDisplayNames = new Set(
    Object.values(customByFieldId).map((f) => f.display_name),
  );
  for (const ref of refs) {
    if (!ROOMS_CORE_DISPLAY_NAMES.has(ref) && !knownCustomDisplayNames.has(ref)) {
      return { error: "missing_ref" };
    }
  }
  if (source === LABEL_FORMULA_SOURCE) {
    const number = String(room.custom_values.number ?? "");
    const name = String(room.custom_values.name ?? "");
    return `${number} — ${name.toUpperCase()}`;
  }
  if (source === 'concat({Tag}, "-", {Name})') {
    const tagFieldId = Object.entries(customByFieldId).find(
      ([, def]) => def.display_name === "Tag",
    )?.[0];
    const tag = tagFieldId ? String(room.custom_values[tagFieldId] ?? "") : "";
    return `${tag}-${String(room.custom_values.name ?? "")}`;
  }
  return null;
}

function recomputeRowsComputed(
  rooms: RoomRow[],
  fieldDefs: TableFieldDef[],
): RoomsSlice["rows_computed"] {
  const rowsComputed: Record<string, Record<string, unknown>> = {};
  const customFields = fieldDefs.filter((field) => field.origin === "custom");
  const customByFieldId = Object.fromEntries(customFields.map((field) => [field.field_key, field]));
  for (const row of rooms) {
    const per: Record<string, unknown> = {};
    for (const field of customFields) {
      if (field.field_type !== "formula") continue;
      const source = String(field.config.source ?? "");
      per[field.field_key] = simulateFormula(source, row, customByFieldId);
    }
    if (Object.keys(per).length > 0) rowsComputed[row.id] = per;
  }
  return rowsComputed;
}

function renderRoomsPage(initialSlice: RoomsSlice) {
  let current = initialSlice;
  let draftCounter = 0;
  const postBodies: RoomsSchemaMutationFixture[] = [];

  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes(`/draft/tables/${ROOMS_TABLE_NAME}/custom-fields:mutate`)) {
      const mutation = JSON.parse(String(init?.body)) as RoomsSchemaMutationFixture;
      postBodies.push(mutation);
      current = applyRoomsSchemaMutationFixture(current, mutation, `d-etag-${++draftCounter}`, {
        rowsComputed: recomputeRowsComputed,
      });
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
      <MemoryRouter>
        <RoomsPage project={buildProject()} />
      </MemoryRouter>
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
  test("adding a formula via modal dispatches the wire shape and surfaces computed values in the grid", async () => {
    const { postBodies } = renderRoomsPage(buildSlice());

    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());

    fireEvent.click(await screen.findByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Label" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Formula" }));
    fireEvent.change(within(dialog).getByLabelText("Expression"), {
      target: { value: LABEL_FORMULA_SOURCE },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));

    expect(await screen.findByRole("columnheader", { name: /^Label\b/ })).toBeInTheDocument();
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    expect(postBodies).toHaveLength(1);
    const add = postBodies[0]!;
    expect(add.kind).toBe("addField");
    if (add.kind !== "addField") throw new Error(`Expected addField, received ${add.kind}`);
    expect(add.after.field_type).toBe("formula");
    const config = (add.after.config ?? {}) as Record<string, unknown>;
    expect(config.source).toBe(LABEL_FORMULA_SOURCE);
    expect(config.deps).toEqual(expect.arrayContaining(["number", "name"]));
    expect(config.ast).toBeTruthy();
  });

  test("the header context menu opens the unified editor for formula custom fields and seeds the stored source", async () => {
    const formulaField = buildFormulaField({
      config: { ...buildFormulaField().config, source: LABEL_FORMULA_SOURCE },
    });
    const seeded = buildSlice({
      field_defs: [...buildSlice().field_defs, formulaField],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
    });

    renderRoomsPage(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    await openHeaderMenu("Label");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));

    const editDialog = await screen.findByRole("dialog", { name: /Edit field/ });
    const expression = within(editDialog).getByLabelText("Expression") as HTMLInputElement;
    expect(expression.value).toBe(LABEL_FORMULA_SOURCE);

    fireEvent.keyDown(editDialog, { key: "Escape" });
    await openHeaderMenu("Name");
    // Built-in fields also surface "Edit field…"; section disabling
    // inside the modal is what enforces per-attribute locks.
    expect(screen.queryByRole("menuitem", { name: "Edit field…" })).not.toBeNull();
  });

  test("built-in editable fields dispatch bundle type changes through RoomsPage", async () => {
    const { postBodies } = renderRoomsPage(buildSlice());
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());

    await openHeaderMenu("Number");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));
    const dialog = await screen.findByRole("dialog", { name: /Edit field/ });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Number" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(postBodies).toHaveLength(1));
    const edit = postBodies[0]!;
    expect(edit.kind).toBe("editFieldBundle");
    if (edit.kind !== "editFieldBundle") {
      throw new Error(`Expected editFieldBundle, received ${edit.kind}`);
    }
    expect(edit.fieldId).toBe("number");
    expect(edit.after).toMatchObject({
      field_key: "number",
      display_name: "Number",
      field_type: "number",
      origin: "built_in",
      config: { precision: 2 },
    });
  });

  test("duplicating a formula via the header context menu dispatches duplicateField and the duplicate column renders the same computed value", async () => {
    const formulaField = buildFormulaField({
      config: { ...buildFormulaField().config, source: LABEL_FORMULA_SOURCE },
    });
    const seeded = buildSlice({
      field_defs: [...buildSlice().field_defs, formulaField],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
    });

    const { postBodies } = renderRoomsPage(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("101 — LIVING ROOM")).toBeInTheDocument();

    await openHeaderMenu("Label");
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate field" }));
    expect(await screen.findByRole("columnheader", { name: /^Label copy\b/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText("101 — LIVING ROOM").length).toBeGreaterThanOrEqual(2),
    );

    expect(postBodies).toHaveLength(1);
    const dup = postBodies[0]!;
    expect(dup.kind).toBe("duplicateField");
    if (dup.kind !== "duplicateField") {
      throw new Error(`Expected duplicateField, received ${dup.kind}`);
    }
    expect(dup.sourceFieldId).toBe("cf_label");
    expect(dup.after.field_type).toBe("formula");
  });

  test("deleting a referenced custom field surfaces the missing_ref error overlay on the formula column", async () => {
    const tag: TableFieldDef = {
      field_key: "cf_tag",
      display_name: "Tag",
      field_type: "short_text",
      config: {},
      description: null,
      origin: "custom",
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
      rooms: [withRoomCustomValues(buildRoom(), { cf_tag: "blue" })],
      field_defs: [...buildSlice().field_defs, tag, formula],
      rows_computed: { rm_1: { cf_label: "blue-Living Room" } },
    });

    const { postBodies } = renderRoomsPage(seeded);
    await waitFor(() => expect(screen.queryByText("Loading table view…")).toBeNull());
    expect(await screen.findByText("blue-Living Room")).toBeInTheDocument();

    await openHeaderMenu("Tag");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete field" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete field" }));

    await waitFor(() => expect(screen.queryByRole("columnheader", { name: /^Tag\b/ })).toBeNull());
    // <ComputedCell> encodes the structured `missing_ref` overlay as an
    // aria-labelled #ERROR glyph; the wire copy is pinned here.
    expect(
      await screen.findByLabelText(
        /Formula error: Formula references a field that no longer exists/,
      ),
    ).toBeInTheDocument();

    expect(postBodies.map((b) => b.kind)).toEqual(["deleteField"]);
  });

  test("viewer mode renders computed values and suppresses every formula-editor affordance", () => {
    const formulaField = buildFormulaField({
      config: { ...buildFormulaField().config, source: LABEL_FORMULA_SOURCE },
    });
    const slice = buildSlice({
      field_defs: [...buildSlice().field_defs, formulaField],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
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
        rowsComputed={slice.rows_computed}
      />,
    );

    expect(screen.getByText("101 — LIVING ROOM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
    const labelHeader = screen.getByRole("columnheader", { name: /^Label\b/ });
    fireEvent.contextMenu(labelHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Edit field…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete field" })).toBeNull();
  });
});
