import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyViewState } from "../../../../shared/ui/data-table";
import { tableFieldDef } from "../../testing/testFixtures";
import { buildEmptyIndoorUnitRow } from "../lib";
import { indoorEquipFieldDefs } from "../indoor-equip-columns";
import { indoorUnitFieldDefs } from "../indoor-unit-columns";
import { outdoorEquipFieldDefs } from "../outdoor-equip-columns";
import { outdoorUnitFieldDefs } from "../outdoor-unit-columns";
import {
  addCustomField,
  customOnlyView,
  expectHeaderOrder,
  fetchMock,
  heatPumpsSlice,
  indoorEquipRow,
  indoorUnitRow,
  outdoorEquipRow,
  outdoorUnitRow,
  renderPanel,
} from "./heatPumpsPanelHarness";

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
    expect(screen.getByText("HP-1")).toBeInTheDocument();

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByText("IU-A")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Units - Outdoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();
    expect(screen.getByText("IU-A")).toBeInTheDocument();
  });

  test("opens the link picker from the indoor equipment incoming-unit add button", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        indoor_units: [
          indoorUnitRow({
            id: "hpiu_01HX0000000000000000000001",
            tag: "IU-1.1",
            indoor_equip_id: "hpie_01HX0000000000000000000000",
          }),
        ],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "Equipment - Indoor" }));
    expect(await screen.findByRole("columnheader", { name: /Indoor units/ })).toBeInTheDocument();

    await user.click(screen.getByRole("gridcell", { name: "IU-1.1" }));
    await user.click(await screen.findByRole("button", { name: "Add linked record" }));

    expect(await screen.findByTestId("linked-record-picker")).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Link Indoor units" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /Indoor equipment:/ })).toBeNull();
  });

  test("opens outdoor unit chips from outdoor equipment incoming-unit links", async () => {
    const user = userEvent.setup();
    renderPanel({
      slice: heatPumpsSlice({
        outdoor_units: [outdoorUnitRow()],
      }),
    });

    await user.click(await screen.findByRole("gridcell", { name: "HP-1" }));
    await user.click(screen.getByRole("button", { name: "HP-1" }));

    expect(await screen.findByRole("dialog", { name: "Outdoor unit: HP-1" })).toBeVisible();
  });

  test("renders paired indoor equipment as linked-record pills from unit links", async () => {
    const user = userEvent.setup();
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
    expect(pairedHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();

    await user.click(screen.getByRole("gridcell", { name: /IE-A/ }));
    await user.click(screen.getByRole("button", { name: /IE-A/ }));

    expect(await screen.findByRole("dialog", { name: /Indoor equipment: IE-A/ })).toBeVisible();
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
