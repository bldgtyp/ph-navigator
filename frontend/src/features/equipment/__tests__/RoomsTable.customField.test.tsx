import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState, type WriteOp } from "../../../shared/ui/data-table";
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
  withRoomCustomValues,
} from "../testing/testFixtures";

describe("RoomsTable custom-field column (plan-14 P1.6)", () => {
  test("renders a seeded custom column at the right with its display name", () => {
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "needs paint" })],
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

    const paintHeader = screen.getByRole("columnheader", { name: /Paint/ });
    expect(paintHeader).toBeInTheDocument();
    expect(screen.getByText("needs paint")).toBeInTheDocument();
  });

  test("uses the cf_* id as the column id (D12 identity)", () => {
    const customField = buildCustomField();
    const onWriteCalls: WriteOp[] = [];
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
    });

    const { container } = render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={(op) => {
          onWriteCalls.push(op);
        }}
      />,
    );

    const cells = container.querySelectorAll('[data-field-key="cf_paint"]');
    expect(cells.length).toBeGreaterThan(0);
  });

  test("renders no custom column when the slice has no custom fields", () => {
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
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

    expect(screen.queryByRole("columnheader", { name: /Paint/ })).not.toBeInTheDocument();
  });
});
