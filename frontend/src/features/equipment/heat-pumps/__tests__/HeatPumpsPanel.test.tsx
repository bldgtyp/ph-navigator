// @size-exception: planning/features/data-table-maintenance/phases/phase-00-cleanup-outline.md
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createQueryClient } from "../../../../app/query-client";
import type { UnitSystem } from "../../../../lib/units";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import {
  emptyViewState,
  type FieldDef,
  type FieldSchemaMutation,
  type TableFieldDef,
  type ViewState,
} from "../../../../shared/ui/data-table";
import type { ProjectDetail } from "../../../projects/types";
import { buildRoom, buildRoomsSlice, tableFieldDef } from "../../testing/testFixtures";
import { buildEmptyIndoorUnitRow } from "../lib";
import { indoorEquipFieldDefs } from "../indoor-equip-columns";
import { indoorUnitFieldDefs } from "../indoor-unit-columns";
import { outdoorEquipFieldDefs } from "../outdoor-equip-columns";
import { outdoorUnitFieldDefs } from "../outdoor-unit-columns";
import { HeatPumpsPanel } from "../routes/HeatPumpsPanel";
import {
  HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME,
  HEAT_PUMP_INDOOR_UNITS_TABLE_NAME,
  HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME,
  HEAT_PUMP_OUTDOOR_UNITS_TABLE_NAME,
  type HeatPumpsSlice,
} from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  window.sessionStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HeatPumpsPanel", () => {
  test("renders nested leaf tabs and mounts the outdoor equipment table", async () => {
    renderPanel();

    expect(await screen.findByRole("tab", { name: "Equipment - Outdoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Equipment - Indoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Units - Outdoor" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Units - Indoor" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Model number/ })).toBeInTheDocument();
    expect(screen.getByText("PUZ-A18NKA7")).toBeInTheDocument();
  });

  test("mounts the outdoor units table on the outdoor-units leaf", async () => {
    const user = userEvent.setup();
    renderPanel({ slice: heatPumpsSlice({ outdoor_units: [outdoorUnitRow()] }) });

    await user.click(await screen.findByRole("tab", { name: "Units - Outdoor" }));

    expect(await screen.findByRole("button", { name: "Add outdoor unit" })).toBeInTheDocument();
    const equipmentHeader = screen.getByRole("columnheader", { name: /Equipment/ });
    expect(equipmentHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /OE-A/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Zone" })).toBeNull();
  });

  test("mounts the indoor units table on the indoor-units leaf", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));

    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();
  });

  test("remembers the last Heat Pumps leaf for the browser session", async () => {
    const user = userEvent.setup();
    const rendered = renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));
    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/proj_1/equipment/heat-pumps/units-indoor",
    );

    rendered.unmount();
    renderPanel({ initialEntry: "/projects/proj_1/equipment/heat-pumps" });

    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/projects/proj_1/equipment/heat-pumps/units-indoor",
      );
    });
  });

  test("renders indoor unit native references as linked-record fields", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            outdoor_unit_id: "hpou_01HX0000000000000000000000",
          }),
        ],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));

    const equipmentHeader = await screen.findByRole("columnheader", { name: /Equipment/ });
    const outdoorHeader = screen.getByRole("columnheader", { name: /Outdoor unit/ });
    const linkedErvHeader = screen.getByRole("columnheader", { name: /Linked ERV/ });
    expect(equipmentHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(outdoorHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(linkedErvHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    expect(await screen.findByRole("button", { name: /IE-A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HP-1" })).toBeInTheDocument();
  });

  test("opens linked room chips in the Room modal without leaving indoor units", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            served_room_ids: ["rm_1"],
          }),
        ],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Units - Indoor" }));
    expect(await screen.findByRole("button", { name: "Add indoor unit" })).toBeInTheDocument();

    const roomChip = await screen.findByRole("button", { name: /101.*Living Room/ });
    fireEvent.click(roomChip);
    fireEvent.click(screen.getByRole("button", { name: /101.*Living Room/ }));

    expect(await screen.findByRole("dialog", { name: "Room: 101 - Living Room" })).toBeVisible();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/proj_1/equipment/heat-pumps/units-indoor",
    );
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/v1/projects/proj_1/table-views/rooms"),
      ),
    ).toBe(false);
  });

  test("mounts the indoor equipment table on the indoor leaf", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));

    expect(await screen.findByRole("button", { name: "Add indoor model" })).toBeInTheDocument();
    expect(screen.getByText("PLA-A18EA8")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Cooling Capacity kW/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Heating Capacity kW/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /47F/ })).toBeNull();
    expect(screen.getAllByText("5.28").length).toBeGreaterThan(0);
  });

  test("shows incoming unit links on referenced Heat Pump tables", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [
          buildEmptyIndoorUnitRow({
            id: "hpiu_01HX0000000000000000000000",
            tag: "IU-A",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
            outdoor_unit_id: "hpou_01HX0000000000000000000000",
          }),
        ],
      }),
    });

    expect(await screen.findByRole("columnheader", { name: /Outdoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HP-1" })).toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IU-A" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Units - Outdoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IU-A" })).toBeInTheDocument();
  });

  test("renders paired indoor equipment as a read-only lookup from unit links", async () => {
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_equip: [outdoorEquipRow({ paired_indoor_equip_id: null })],
        outdoor_units: [outdoorUnitRow()],
        indoor_units: [indoorUnitRow()],
      }),
    });

    const pairedHeader = await screen.findByRole("columnheader", {
      name: /Paired indoor equip/,
    });
    expect(pairedHeader).toBeInTheDocument();
    expect(screen.getByText(/PLA-A18EA8/)).toBeInTheDocument();
  });

  test("renders indoor equipment capacity columns in IP units", async () => {
    const user = userEvent.setup();
    renderPanel({ unitSystem: "IP" });

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));

    expect(
      await screen.findByRole("columnheader", { name: /Cooling Capacity kBtu\/h/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /Heating Capacity kBtu\/h/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("18.0").length).toBeGreaterThan(0);
  });

  test("keeps outdoor equipment field order across leaf remounts", async () => {
    const user = userEvent.setup();
    renderPanel();

    await expectHeaderOrder(["Tag", "Model number", "Manufacturer"]);

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("button", { name: "Add indoor model" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Equipment - Outdoor" }));
    await expectHeaderOrder(["Tag", "Model number", "Manufacturer"]);
  });

  test("adds an outdoor equipment row through the generic table replace API", async () => {
    const user = userEvent.setup();
    renderPanel({ slice: heatPumpsSlice({ outdoor_equip: [] }) });

    await user.click(await screen.findByRole("button", { name: "Add outdoor equipment" }));
    await user.type(screen.getByLabelText("Tag"), "OE-X");
    await user.type(screen.getByLabelText("Model number"), "PUZ-A24NHA7");
    await user.click(screen.getByRole("button", { name: "Save outdoor equipment" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/projects/proj_1/versions/ver_1/draft/tables/heat_pumps_outdoor_equip",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining('"outdoor_equip"'),
        }),
      );
    });
  });

  test("renders server custom fields on each Heat Pump leaf", async () => {
    const user = userEvent.setup();
    renderPanel({
      savedTableViews: {
        heat_pumps_outdoor_equip: customOnlyView(
          outdoorEquipFieldDefs({ options: {} }),
          "cf_outdoor_equip_note",
        ),
        heat_pumps_indoor_equip: customOnlyView(indoorEquipFieldDefs({}), "cf_indoor_equip_note"),
        heat_pumps_outdoor_units: customOnlyView(outdoorUnitFieldDefs(), "cf_outdoor_unit_note"),
        heat_pumps_indoor_units: customOnlyView(indoorUnitFieldDefs(), "cf_indoor_unit_note"),
      },
      customFieldsByLeaf: {
        heat_pumps_outdoor_equip: [
          tableFieldDef({ field_key: "cf_outdoor_equip_note", display_name: "Outdoor review" }),
        ],
        heat_pumps_indoor_equip: [
          tableFieldDef({ field_key: "cf_indoor_equip_note", display_name: "Indoor review" }),
        ],
        heat_pumps_outdoor_units: [
          tableFieldDef({ field_key: "cf_outdoor_unit_note", display_name: "Outdoor unit note" }),
        ],
        heat_pumps_indoor_units: [
          tableFieldDef({ field_key: "cf_indoor_unit_note", display_name: "Indoor unit note" }),
        ],
      },
      slice: heatPumpsSlice({
        outdoor_equip: [
          outdoorEquipRow({ custom_values: { cf_outdoor_equip_note: "Outdoor custom" } }),
        ],
        indoor_equip: [
          indoorEquipRow({ custom_values: { cf_indoor_equip_note: "Indoor custom" } }),
        ],
        outdoor_units: [
          outdoorUnitRow({ custom_values: { cf_outdoor_unit_note: "Outdoor unit custom" } }),
        ],
        indoor_units: [
          indoorUnitRow({ custom_values: { cf_indoor_unit_note: "Indoor unit custom" } }),
        ],
      }),
    });

    expect(await screen.findByRole("columnheader", { name: /Outdoor review/ })).toBeInTheDocument();
    expect(screen.getByText("Outdoor custom")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor review/ })).toBeInTheDocument();
    expect(screen.getByText("Indoor custom")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Units - Outdoor" }));
    expect(
      await screen.findByRole("columnheader", { name: /Outdoor unit note/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Outdoor unit custom")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Units - Indoor" }));
    expect(
      await screen.findByRole("columnheader", { name: /Indoor unit note/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Indoor unit custom")).toBeInTheDocument();
  });

  test("custom-field schema adds route through the generic Heat Pump leaf endpoint", async () => {
    const { schemaMutations } = renderPanel({
      savedTableViews: {
        heat_pumps_outdoor_equip: customOnlyView(
          outdoorEquipFieldDefs({ options: {} }),
          "cf_existing",
        ),
      },
      customFieldsByLeaf: {
        heat_pumps_outdoor_equip: [
          tableFieldDef({ field_key: "cf_existing", display_name: "Existing field" }),
        ],
      },
      slice: heatPumpsSlice({
        outdoor_equip: [outdoorEquipRow({ custom_values: { cf_existing: "seed" } })],
      }),
    });

    await addCustomField("Reviewer");
    await waitFor(() =>
      expect(screen.getByRole("columnheader", { name: /^Reviewer\b/ })).toBeVisible(),
    );

    expect(schemaMutations).toHaveLength(1);
    expect(schemaMutations[0]).toMatchObject({
      kind: "addField",
      tableKey: "heat_pumps_outdoor_equip",
      after: { display_name: "Reviewer", field_type: "short_text" },
    });
  });

  test("requests Heat Pump leaf view state through the shared table-view endpoint", async () => {
    renderPanel({
      savedTableViews: {
        heat_pumps_outdoor_equip: {
          ...emptyViewState(),
          hiddenColumns: ["model_number"],
          columnOrder: ["tag", "manufacturer", "model_number"],
        },
      },
    });

    expect(await screen.findByRole("columnheader", { name: /^Tag\b/ })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/api/v1/projects/proj_1/table-views/heat_pumps_outdoor_equip"),
      ),
    ).toBe(true);
  });

  test("viewer mode renders Heat Pump custom fields without edit affordances", async () => {
    renderPanel({
      projectOverride: { access_mode: "viewer" },
      customFieldsByLeaf: {
        heat_pumps_outdoor_equip: [
          tableFieldDef({
            field_key: "cf_review",
            display_name: "Review note",
            description: "Readonly field description",
          }),
        ],
      },
      slice: heatPumpsSlice({
        outdoor_equip: [outdoorEquipRow({ custom_values: { cf_review: "viewer value" } })],
      }),
    });

    const reviewHeader = await screen.findByRole("columnheader", { name: /Review note/ });
    expect(screen.getByText("viewer value")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();

    fireEvent.contextMenu(reviewHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/table-views/"))).toBe(false);
  });
});

function renderPanel({
  slice = heatPumpsSlice(),
  unitSystem = "SI",
  savedTableViews = {},
  customFieldsByLeaf = {},
  initialEntry = "/projects/proj_1/equipment/heat-pumps/equipment-outdoor",
  projectOverride = {},
}: {
  slice?: HeatPumpsSlice;
  unitSystem?: UnitSystem;
  savedTableViews?: Record<string, ViewState>;
  customFieldsByLeaf?: Partial<Record<HeatPumpTableName, TableFieldDef[]>>;
  initialEntry?: string;
  projectOverride?: Partial<ProjectDetail>;
} = {}) {
  const leafCustomFields = copyCustomFieldsByLeaf(customFieldsByLeaf);
  const tableViews = new Map<string, ViewState>(
    Object.entries(savedTableViews).map(([key, view]) => [key, structuredClone(view)]),
  );
  const schemaMutations: FieldSchemaMutation[] = [];
  let draftCounter = 1;
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({ items: [] });
    }
    const schemaMutationTableName = heatPumpSchemaMutationTableNameFromUrl(url);
    if (schemaMutationTableName) {
      const mutation = JSON.parse(String(init?.body)) as FieldSchemaMutation;
      schemaMutations.push(mutation);
      applyHeatPumpSchemaMutationFixture(leafCustomFields, schemaMutationTableName, mutation);
      draftCounter += 1;
      return jsonResponse(
        heatPumpLeafResponse(url.replace("/custom-fields:mutate", ""), slice, leafCustomFields, {
          draftEtag: `draft_${draftCounter}`,
        }),
      );
    }
    const heatPumpLeaf = heatPumpLeafResponse(url, slice, leafCustomFields);
    if (heatPumpLeaf) {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return jsonResponse({
          ...heatPumpLeaf,
          source: "draft",
          draft_etag: "draft_2",
          ...body,
        });
      }
      return jsonResponse(heatPumpLeaf);
    }
    if (url.endsWith("/api/v1/projects/proj_1/versions/ver_1/draft/tables/rooms")) {
      return jsonResponse(roomsSlice());
    }
    const tableViewMatch = url.match(/\/api\/v1\/projects\/proj_1\/table-views\/([^/?]+)$/);
    const tableKey = tableViewMatch?.[1];
    if (tableKey) {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as {
          view_state: { view_state: ViewState };
        };
        const viewState = structuredClone(body.view_state.view_state);
        tableViews.set(tableKey, viewState);
        return jsonResponse({
          view_state_schema_version: 1,
          view_state: { schema_fingerprint: "test-fingerprint", view_state: viewState },
          updated_at: "2026-06-17T00:00:00Z",
        });
      }
      const view = tableViews.get(tableKey);
      return jsonResponse({
        view_state_schema_version: 1,
        view_state: view ? { schema_fingerprint: "test-fingerprint", view_state: view } : null,
        updated_at: view ? "2026-06-16T00:00:00Z" : null,
      });
    }
    return jsonResponse({});
  });
  const queryClient = createQueryClient();
  const rendered = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <UnitPreferenceContext.Provider
          value={{
            unitSystem,
            source: "default",
            error: null,
            setUnitSystem: () => undefined,
            toggleUnitSystem: () => undefined,
          }}
        >
          <Routes>
            <Route
              path="/projects/:projectId/equipment/*"
              element={
                <>
                  <LocationProbe />
                  <HeatPumpsPanel project={project(projectOverride)} />
                </>
              }
            />
          </Routes>
        </UnitPreferenceContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...rendered, schemaMutations };
}

async function expectHeaderOrder(expectedHeaders: string[]) {
  const firstHeader = expectedHeaders[0];
  if (!firstHeader) throw new Error("Expected at least one header.");
  await screen.findByRole("columnheader", { name: new RegExp(firstHeader) });
  const headers = screen.getAllByRole("columnheader");
  const indexes = expectedHeaders.map((header) =>
    headers.findIndex((element) => element.textContent?.includes(header)),
  );
  expect(indexes.every((index) => index >= 0)).toBe(true);
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
}

async function addCustomField(displayName: string) {
  fireEvent.click(await screen.findByRole("button", { name: "Add field" }));
  const dialog = await screen.findByRole("dialog", { name: "Add field" });
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: displayName },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type HeatPumpTableName =
  | typeof HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME
  | typeof HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME
  | typeof HEAT_PUMP_OUTDOOR_UNITS_TABLE_NAME
  | typeof HEAT_PUMP_INDOOR_UNITS_TABLE_NAME;

const HEAT_PUMP_LEAF_FIXTURES: Record<
  HeatPumpTableName,
  {
    fieldDefs: (slice: HeatPumpsSlice) => FieldDef[];
    rowKey: "outdoor_equip" | "indoor_equip" | "outdoor_units" | "indoor_units";
  }
> = {
  [HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME]: {
    fieldDefs: (slice) => outdoorEquipFieldDefs({ options: slice.single_select_options }),
    rowKey: "outdoor_equip",
  },
  [HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME]: {
    fieldDefs: (slice) => indoorEquipFieldDefs(slice.single_select_options),
    rowKey: "indoor_equip",
  },
  [HEAT_PUMP_OUTDOOR_UNITS_TABLE_NAME]: {
    fieldDefs: () => outdoorUnitFieldDefs(),
    rowKey: "outdoor_units",
  },
  [HEAT_PUMP_INDOOR_UNITS_TABLE_NAME]: {
    fieldDefs: () => indoorUnitFieldDefs(),
    rowKey: "indoor_units",
  },
};

function heatPumpLeafResponse(
  url: string,
  slice: HeatPumpsSlice,
  customFieldsByLeaf: Partial<Record<HeatPumpTableName, TableFieldDef[]>>,
  options: { draftEtag?: string } = {},
): Record<string, unknown> | null {
  const tableName = heatPumpTableNameFromUrl(url);
  if (!tableName) return null;
  const fixture = HEAT_PUMP_LEAF_FIXTURES[tableName];
  const base = {
    project_id: slice.project_id,
    version_id: slice.version_id,
    source: options.draftEtag ? "draft" : slice.source,
    version_etag: slice.version_etag,
    draft_etag: options.draftEtag ?? slice.draft_etag,
    field_defs: [],
    single_select_options: slice.single_select_options,
    rows_computed: {},
  };
  return {
    ...base,
    field_defs: [
      ...tableFieldDefs(fixture.fieldDefs(slice)),
      ...(customFieldsByLeaf[tableName] ?? []),
    ],
    [fixture.rowKey]: slice[fixture.rowKey],
  };
}

function heatPumpTableNameFromUrl(url: string): HeatPumpTableName | null {
  const tableName = Object.keys(HEAT_PUMP_LEAF_FIXTURES).find((candidate) =>
    url.endsWith(`/${candidate}`),
  );
  return (tableName as HeatPumpTableName | undefined) ?? null;
}

function heatPumpSchemaMutationTableNameFromUrl(url: string): HeatPumpTableName | null {
  const tableName = Object.keys(HEAT_PUMP_LEAF_FIXTURES).find((candidate) =>
    url.endsWith(`/${candidate}/custom-fields:mutate`),
  );
  return (tableName as HeatPumpTableName | undefined) ?? null;
}

function copyCustomFieldsByLeaf(
  customFieldsByLeaf: Partial<Record<HeatPumpTableName, TableFieldDef[]>>,
): Partial<Record<HeatPumpTableName, TableFieldDef[]>> {
  return Object.fromEntries(
    Object.entries(customFieldsByLeaf).map(([tableName, fieldDefs]) => [
      tableName,
      fieldDefs?.map(copyTableFieldDef) ?? [],
    ]),
  ) as Partial<Record<HeatPumpTableName, TableFieldDef[]>>;
}

function applyHeatPumpSchemaMutationFixture(
  customFieldsByLeaf: Partial<Record<HeatPumpTableName, TableFieldDef[]>>,
  tableName: HeatPumpTableName,
  mutation: FieldSchemaMutation,
) {
  const fields = customFieldsByLeaf[tableName] ?? [];
  switch (mutation.kind) {
    case "addField":
      customFieldsByLeaf[tableName] = [...fields, copyTableFieldDef(mutation.after)];
      break;
    case "changeType":
    case "deleteField":
    case "duplicateField":
    case "editFieldBundle":
    case "editOptions":
    case "renameField":
    case "setDescription":
    case "setFormula":
      throw new Error(`Unsupported Heat Pump schema mutation fixture: ${mutation.kind}`);
  }
}

function tableFieldDefs(fieldDefs: FieldDef[]): TableFieldDef[] {
  return fieldDefs.map((fieldDef) => ({
    field_key: fieldDef.field_key,
    display_name: fieldDef.display_name,
    field_type: tableFieldType(fieldDef),
    description: fieldDef.description ?? null,
    config: tableFieldConfig(fieldDef),
    origin: "built_in",
    created_at: "2026-06-17T00:00:00Z",
    created_by: null,
  }));
}

function tableFieldType(fieldDef: FieldDef): TableFieldDef["field_type"] {
  if (fieldDef.field_type === "text") return "short_text";
  if (fieldDef.field_type === "attachment") return "long_text";
  if (fieldDef.field_type === "lookup") return "short_text";
  if (fieldDef.field_type === "computed") return "formula";
  return fieldDef.field_type;
}

function tableFieldConfig(fieldDef: FieldDef): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (fieldDef.numberUnits) config.units = fieldDef.numberUnits;
  if (fieldDef.linked_record_config) Object.assign(config, fieldDef.linked_record_config);
  return config;
}

function customOnlyView(builtInFields: FieldDef[], customFieldKey: string): ViewState {
  return {
    ...emptyViewState(),
    columnOrder: ["tag", customFieldKey],
    hiddenColumns: builtInFields
      .map((fieldDef) => fieldDef.field_key)
      .filter((fieldKey) => fieldKey !== "tag"),
  };
}

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: "proj_1",
    name: "Test Project",
    bt_number: "BT-001",
    client: null,
    cert_programs: ["phius"],
    phius_number: null,
    phius_dropbox_url: null,
    access_mode: "editor",
    active_version_id: "ver_1",
    active_version: version(),
    versions: [version()],
    last_saved_at: null,
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
    owner_display_name: "Ed",
    ...overrides,
  };
}

function version() {
  return {
    id: "ver_1",
    project_id: "proj_1",
    name: "Base",
    kind: "working",
    locked: false,
    schema_version: 1,
    body_size_bytes: 100,
    created_at: "2026-06-09T00:00:00Z",
    updated_at: "2026-06-09T00:00:00Z",
  } satisfies ProjectDetail["active_version"];
}

function heatPumpsSlice(overrides: Partial<HeatPumpsSlice> = {}): HeatPumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "version",
    version_etag: "version_1",
    draft_etag: null,
    outdoor_equip: [outdoorEquipRow()],
    indoor_equip: [indoorEquipRow()],
    outdoor_units: [],
    indoor_units: [],
    single_select_options: {},
    ...overrides,
  };
}

function roomsSlice() {
  return buildRoomsSlice({
    project_id: "proj_1",
    version_id: "ver_1",
    source: "version",
    version_etag: "version_1",
    draft_etag: null,
    rooms: [buildRoom()],
    rows_computed: {},
  });
}

function outdoorEquipRow(overrides: Partial<HeatPumpsSlice["outdoor_equip"][number]> = {}) {
  return {
    id: "hpoe_01HX0000000000000000000000",
    tag: "OE-A",
    manufacturer: "opt_mitsubishi",
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: "hpie_01HX0000000000000000000000",
    system_family: "opt_puz",
    refrigerant: "opt_r_410a",
    heating_cap_kw_17f: 3.52,
    heating_cap_kw_47f: 5.28,
    heating_data_type: "COPs",
    heating_cop_17f: 2.1,
    heating_cop_47f: 3.2,
    hspf: null,
    cooling_cap_kw_95f: 5.28,
    cooling_data_type: "EER2/SEER2",
    eer: 10.5,
    seer: 17,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
  return {
    id: "hpie_01HX0000000000000000000000",
    tag: "IE-A",
    manufacturer: "opt_mitsubishi",
    model_type: "opt_wall",
    model_number: "PLA-A18EA8",
    install_type: "opt_standard",
    nominal_tons: 1.5,
    fan_speed_cfm: null,
    cooling_btuh: 5.28,
    heating_btuh_47f: 5.28,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}

function outdoorUnitRow(overrides: Partial<HeatPumpsSlice["outdoor_units"][number]> = {}) {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-1",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_units"][number];
}

function indoorUnitRow(overrides: Partial<HeatPumpsSlice["indoor_units"][number]> = {}) {
  return {
    id: "hpiu_01HX0000000000000000000000",
    tag: "IU-A",
    indoor_equip_id: "hpie_01HX0000000000000000000000",
    outdoor_unit_id: "hpou_01HX0000000000000000000000",
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_units"][number];
}
