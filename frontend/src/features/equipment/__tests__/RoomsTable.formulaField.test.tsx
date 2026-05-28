import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState } from "../../../shared/ui/data-table";
import {
  buildFormulaField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
} from "../testing/testFixtures";

// Plan-17 P4.9: the grid renders formula custom-field columns via
// `<ComputedCell>` reading `rows_computed[rowId][cf_id]`. Successful
// scalars render verbatim; structured `{error: token}` overlays render
// the `#ERROR` glyph with a descriptive aria-label.

describe("RoomsTable formula columns (plan-17 P4.9)", () => {
  test("renders the computed scalar from rows_computed", () => {
    const formulaField = buildFormulaField();
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(formulaField),
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
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
        rowsComputed={slice.rows_computed}
      />,
    );
    expect(screen.getByText("101 — LIVING ROOM")).toBeInTheDocument();
  });

  test("renders #ERROR glyph for structured-error overlay values", () => {
    const formulaField = buildFormulaField();
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(formulaField),
      rows_computed: { rm_1: { cf_label: { error: "div_by_zero" } } },
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
        rowsComputed={slice.rows_computed}
      />,
    );
    const errorCell = screen.getByLabelText(/Formula error:/);
    expect(errorCell).toBeInTheDocument();
    expect(errorCell).toHaveTextContent("#ERROR");
  });

  test("renders an empty cell when no overlay entry exists for the row", () => {
    const formulaField = buildFormulaField();
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(formulaField),
      rows_computed: {},
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
        rowsComputed={slice.rows_computed}
      />,
    );
    // No `#ERROR` glyph appears.
    expect(screen.queryByText("#ERROR")).toBeNull();
    // The formula cell itself rendered (locate by the column header).
    expect(container.querySelector('[data-field-key="cf_label"]')).not.toBeNull();
  });
});
