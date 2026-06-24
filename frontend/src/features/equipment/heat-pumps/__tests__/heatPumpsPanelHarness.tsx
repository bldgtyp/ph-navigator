// Render harness + fixtures for HeatPumpsPanel.test.tsx. Extracted from the
// spec file so the spec stays under the structural file-size guard. The
// `fetchMock` exported here is the single instance the spec wires into
// `beforeEach`/`afterEach`; `renderPanel` closes over the same instance.
//
// This is a test-only render harness (it mixes the internal `LocationProbe`
// component with fixture/helper exports), so fast-refresh's
// single-component-export rule does not apply.
/* eslint-disable react-refresh/only-export-components */
import { QueryClientProvider } from "@tanstack/react-query";
import { expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
import { buildRoom, buildRoomsSlice } from "../../testing/testFixtures";
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
import { STATUS_OPTION_FIXTURES } from "./statusOptionFixtures";
import {
  HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY,
  HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY,
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
} from "../../types";

export const fetchMock = vi.fn();

export function renderPanel({
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

export async function expectHeaderOrder(expectedHeaders: string[]) {
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

export async function addCustomField(displayName: string) {
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
    fieldDefs: (slice) => outdoorUnitFieldDefs(slice.single_select_options),
    rowKey: "outdoor_units",
  },
  [HEAT_PUMP_INDOOR_UNITS_TABLE_NAME]: {
    fieldDefs: (slice) => indoorUnitFieldDefs(slice.single_select_options),
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

export function customOnlyView(builtInFields: FieldDef[], customFieldKey: string): ViewState {
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

export function heatPumpsSlice(overrides: Partial<HeatPumpsSlice> = {}): HeatPumpsSlice {
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
    single_select_options: {
      [HEAT_PUMPS_OUTDOOR_EQUIP_STATUS_OPTION_KEY]: STATUS_OPTION_FIXTURES,
      [HEAT_PUMPS_INDOOR_EQUIP_STATUS_OPTION_KEY]: STATUS_OPTION_FIXTURES,
    },
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

export function outdoorEquipRow(overrides: Partial<HeatPumpsSlice["outdoor_equip"][number]> = {}) {
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
    custom_values: { [STATUS_FIELD_KEY]: STATUS_DEFAULT_OPTION_ID },
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_equip"][number];
}

export function indoorEquipRow(overrides: Partial<HeatPumpsSlice["indoor_equip"][number]> = {}) {
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
    custom_values: { [STATUS_FIELD_KEY]: STATUS_DEFAULT_OPTION_ID },
    ...overrides,
  } satisfies HeatPumpsSlice["indoor_equip"][number];
}

export function outdoorUnitRow(overrides: Partial<HeatPumpsSlice["outdoor_units"][number]> = {}) {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-1",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  } satisfies HeatPumpsSlice["outdoor_units"][number];
}

export function indoorUnitRow(overrides: Partial<HeatPumpsSlice["indoor_units"][number]> = {}) {
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
