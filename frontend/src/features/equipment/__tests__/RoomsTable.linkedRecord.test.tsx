import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  buildLinkedRecordOps,
  emptyViewState,
  type LinkedRecordCellOps,
} from "../../../shared/ui/data-table";
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
} from "../testing/testFixtures";
import { PUMPS_TARGET_TABLE_PATH } from "../types";

const linkedRecordField = () =>
  buildCustomField({
    field_key: "cf_pumps",
    display_name: "Pumps",
    field_type: "linked_record",
    config: { target_table_path: ["equipment", "pumps"], max_links: null },
  });

describe("RoomsTable linked_record column", () => {
  test("renders pill labels via the resolver supplied through linkedRecordOps", () => {
    const room = buildRoom();
    room.custom_links = { cf_pumps: ["pump_row_a", "pump_row_b"] };
    const slice = buildRoomsSlice({
      rooms: [room],
      field_defs: roomsFieldDefs(linkedRecordField()),
    });

    const ops: ReadonlyMap<string, LinkedRecordCellOps> = buildLinkedRecordOps({
      fieldDefs: schemaForRooms(slice).fieldDefs,
      targetTablePath: ["equipment", "pumps"],
      targetRows: [
        { id: "pump_row_a", record_id: "P-001" },
        { id: "pump_row_b", record_id: "P-002" },
      ],
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
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
        linkedRecordOps={ops}
      />,
    );

    expect(screen.getByText("P-001")).toBeInTheDocument();
    expect(screen.getByText("P-002")).toBeInTheDocument();
  });

  test("falls back to read-only pill rendering when linkedRecordOps is omitted", () => {
    const room = buildRoom();
    room.custom_links = { cf_pumps: ["pump_row_a"] };
    const slice = buildRoomsSlice({
      rooms: [room],
      field_defs: roomsFieldDefs(linkedRecordField()),
    });

    const { container } = render(
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

    expect(container.querySelectorAll('[data-field-key="cf_pumps"]').length).toBeGreaterThan(0);
  });

  test("onPillClick fires when a pill is clicked", () => {
    const room = buildRoom();
    room.custom_links = { cf_pumps: ["pump_row_a"] };
    const slice = buildRoomsSlice({
      rooms: [room],
      field_defs: roomsFieldDefs(linkedRecordField()),
    });

    const onPillClick = vi.fn();
    const ops = buildLinkedRecordOps({
      fieldDefs: schemaForRooms(slice).fieldDefs,
      targetTablePath: ["equipment", "pumps"],
      targetRows: [{ id: "pump_row_a", record_id: "P-001" }],
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
      onPillClick,
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
        linkedRecordOps={ops}
      />,
    );

    // Airtable parity: first click activates the cell, second click on
    // the pill fires the nav callback.
    fireEvent.click(screen.getByText("P-001"));
    fireEvent.click(screen.getByText("P-001"));
    expect(onPillClick).toHaveBeenCalledWith("pump_row_a");
  });

  // §A1 regression: RoomsPage previously built `targetTablePath` from
  // `[PUMPS_TABLE_NAME]` = `["pumps"]`, but the backend canonical path
  // persisted on linked_record FieldDefs is `["equipment", "pumps"]`.
  // The mismatch silently emitted an empty ops Map and broke every
  // linked_record pill render + the picker candidate list. This test
  // pins the shared constant against a backend-shaped FieldDef fixture
  // so any future drift fails loudly.
  test("PUMPS_TARGET_TABLE_PATH matches FieldDef config and yields a non-empty ops Map", () => {
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(linkedRecordField()),
    });
    const ops = buildLinkedRecordOps({
      fieldDefs: schemaForRooms(slice).fieldDefs,
      targetTablePath: PUMPS_TARGET_TABLE_PATH,
      targetRows: [{ id: "pump_row_a", record_id: "P-001" }],
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
    });
    expect(ops.size).toBeGreaterThan(0);
    expect(ops.get("cf_pumps")).toBeDefined();
  });
});
