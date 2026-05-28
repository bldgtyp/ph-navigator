import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState } from "../../../shared/ui/data-table";
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
  withRoomCustomValues,
} from "../testing/testFixtures";

describe("RoomsTable header locked-indicator (plan-15 P2.5)", () => {
  test("every core column renders with the schema-locked indicator", () => {
    const slice = buildRoomsSlice({ rooms: [buildRoom()] });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
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
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
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
    const customField = buildCustomField({ description: "  LCA category override  " });
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
    });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
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
    const customField = buildCustomField({ description: "View-only description" });
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
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
  });

  test("custom-field header context menu surfaces Delete field; confirm dispatches the typed mutation", async () => {
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
    });
    const onDeleteCustomField = vi.fn().mockResolvedValue(undefined);

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
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
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(buildCustomField()),
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
        onDeleteCustomField={vi.fn()}
      />,
    );
    const paintHeader = screen.getByRole("columnheader", { name: /^Paint\b/ });
    fireEvent.contextMenu(paintHeader, { clientX: 100, clientY: 50 });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
