import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

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
    project_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag",
    rooms: [],
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

describe("RoomsTable header locked-indicator (plan-15 P2.5)", () => {
  test("every core column renders with the schema-locked indicator", () => {
    const slice = buildSlice({ rooms: [buildRoom()], custom_fields: [] });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    // Pick a couple of representative core columns and confirm the
    // attribute is present (the SortableHeaderCell sets
    // `data-schema-locked="true"` only when `schemaLocked` is true).
    // The accessible name on a header `<th>` accumulates child text:
    // for resizable columns that includes the "Resize column" button
    // label. Match on the column label as a prefix word.
    for (const name of [/^Number\b/, /^Name\b/, /^Floor\b/, /^Zone\b/, /^iCFA\b/]) {
      const header = screen.getByRole("columnheader", { name });
      expect(header.getAttribute("data-schema-locked")).toBe("true");
      // The lock glyph renders inside the header row.
      expect(within(header).getByTestId("data-table-header-lock")).toBeInTheDocument();
    }
  });

  test("a seeded custom column renders WITHOUT the schema-locked indicator", () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField()],
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    expect(paintHeader.getAttribute("data-schema-locked")).toBeNull();
    expect(within(paintHeader).queryByTestId("data-table-header-lock")).toBeNull();
  });

  test("description tooltip surfaces when the custom field carries a description", () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField({ description: "  LCA category override  " })],
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );
    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    const trigger = within(paintHeader).getByRole("button", {
      name: "Description for Paint",
    });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip").textContent).toBe("LCA category override");
  });

  test("viewer mode still renders the lock glyph and description tooltip", () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField({ description: "View-only description" })],
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
  });

  test("custom-field header context menu surfaces Delete field; confirm dispatches the typed mutation", async () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField()],
    });
    const onDeleteCustomField = vi.fn().mockResolvedValue(undefined);

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        onDeleteCustomField={onDeleteCustomField}
      />,
    );

    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    fireEvent.contextMenu(paintHeader, { clientX: 100, clientY: 50 });

    const deleteItem = await screen.findByRole("menuitem", { name: "Delete field" });
    fireEvent.click(deleteItem);

    // The confirm dialog mentions the field's display name and the
    // count of populated rows (one row in the fixture has cf_paint set).
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Delete field “Paint”\?/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/1 row currently has a value for this field/),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete field" }));

    expect(onDeleteCustomField).toHaveBeenCalledTimes(1);
    expect(onDeleteCustomField).toHaveBeenCalledWith("cf_paint");
  });

  test("viewer mode suppresses the header context menu entirely", () => {
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildCustomField()],
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
        onDeleteCustomField={vi.fn()}
      />,
    );
    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    fireEvent.contextMenu(paintHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
