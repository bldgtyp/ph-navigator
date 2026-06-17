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

describe("RoomsTable header field indicators", () => {
  test("core columns render schema-locked state and field-type icons", () => {
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
    for (const [name, type] of [
      [/^Display Name\b/, "formula"],
      [/^Number\b/, "short_text"],
      [/^Floor\b/, "single_select"],
      [/^iCFA\b/, "number"],
    ] as const) {
      const header = screen.getByRole("columnheader", { name });
      expect(header.getAttribute("data-schema-locked")).toBe("true");
      expect(within(header).getByTestId("data-table-field-type-icon")).toHaveAttribute(
        "data-field-type-icon",
        type,
      );
    }
  });

  test("a seeded custom column renders WITHOUT schema-locked state and still shows type", () => {
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
    expect(within(paintHeader).getByTestId("data-table-field-type-icon")).toHaveAttribute(
      "data-field-type-icon",
      "short_text",
    );
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

  test("viewer mode still renders the field-type icon and description tooltip", () => {
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
    expect(within(nameHeader).getByTestId("data-table-field-type-icon")).toHaveAttribute(
      "data-field-type-icon",
      "short_text",
    );
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
