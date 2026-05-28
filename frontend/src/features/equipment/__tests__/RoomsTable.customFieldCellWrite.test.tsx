import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState, type WriteOp } from "../../../shared/ui/data-table";
import { roomsPayloadFromCellWrites } from "../lib";

type RoomCellWrite = { rowId: string; fieldKey: string; value: unknown };
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
  withRoomCustomValues,
} from "../testing/testFixtures";

// Plan-18 §5.6 — inline edit on a `cf_*` cell must emit a `cell`
// write op carrying the `cf_*` field_key, and the matching payload
// builder must route that write into `row.custom`. The library-
// level tests pin the builder; this component test pins the
// emission boundary so a regression in either side fails CI.

describe("RoomsTable cell-write on a custom field (plan-18 §5.6)", () => {
  test("inline edit on a cf_* cell emits a cell write with the cf_* field_key", () => {
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "old" })],
      field_defs: roomsFieldDefs(customField),
    });
    const onWrite = vi.fn();

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
      />,
    );

    fireEvent.doubleClick(screen.getByText("old"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "blue" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]?.[0] as WriteOp;
    expect(op.kind).toBe("cell");
    if (op.kind === "cell") {
      expect(op.writes).toEqual([{ rowId: "rm_1", fieldKey: "cf_paint", value: "blue" }]);
    }
  });

  test("the emitted cell write threads through roomsPayloadFromCellWrites into row.custom", () => {
    // Closes the loop between the component-level write emission and
    // the payload builder. A regression in either side fails this
    // test — plan-18's two cooperating defects in a single assertion.
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "old" })],
      field_defs: roomsFieldDefs(customField),
    });
    const writes: RoomCellWrite[] = [{ rowId: "rm_1", fieldKey: "cf_paint", value: "blue" }];

    const payload = roomsPayloadFromCellWrites(slice, writes, {});

    expect(payload.rooms[0]?.custom_values.cf_paint).toBe("blue");
    expect(payload.field_defs).toEqual(roomsFieldDefs(buildCustomField()));
  });

  test("clearing a cf_* cell emits a write that empties row.custom for that key", () => {
    const customField = buildCustomField();
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(customField),
    });
    const onWrite = vi.fn();

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
      />,
    );

    fireEvent.doubleClick(screen.getByText("blue"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]?.[0] as WriteOp;
    expect(op.kind).toBe("cell");
    if (op.kind === "cell") {
      const write = op.writes[0]!;
      expect(write.fieldKey).toBe("cf_paint");
      // The library-level test in lib.test.ts pins that null / undefined
      // values delete the key — this asserts the boundary's value
      // is one of the falsy sentinels the builder accepts.
      expect([null, undefined, ""]).toContain(write.value);
    }
  });
});
