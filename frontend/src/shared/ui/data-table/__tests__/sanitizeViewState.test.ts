import { describe, expect, test } from "vitest";
import { sanitizeViewStateForSchema } from "../lib/view/sanitize";
import type { DataTableColumnDef, FieldDef, ViewState } from "../types";

type Row = {
  id: string;
  name: string;
  floor: string | null;
  notes: string | null;
};

const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_first", label: "1st", color: "#10b981", order: 1 },
    ],
  },
  { field_key: "notes", field_type: "text", display_name: "Notes" },
];

const columns: DataTableColumnDef<Row>[] = [
  { id: "col-name", fieldKey: "name", header: "Name", accessor: (r) => r.name },
  { id: "col-floor", fieldKey: "floor", header: "Floor", accessor: (r) => r.floor },
  { id: "col-notes", fieldKey: "notes", header: "Notes", accessor: (r) => r.notes },
];

function baseView(overrides: Partial<ViewState> = {}): ViewState {
  return {
    filter: [],
    sort: [],
    group: [],
    aggregations: {},
    columnOrder: [],
    columnWidths: {},
    hiddenColumns: [],
    expandedGroups: {},
    ...overrides,
  };
}

describe("sanitizeViewStateForSchema", () => {
  test("drops sort rules whose field is unknown", () => {
    const view = baseView({
      sort: [
        { fieldKey: "name", direction: "asc" },
        { fieldKey: "deleted_field", direction: "desc" },
      ],
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);
  });

  test("drops filter rules whose field is unknown", () => {
    const view = baseView({
      filter: [
        { fieldKey: "name", operator: "contains", value: "kitchen" },
        { fieldKey: "ghost_field", operator: "contains", value: "x" },
      ],
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.filter.map((rule) => rule.fieldKey)).toEqual(["name"]);
  });

  test("prunes filter option refs whose option id no longer exists", () => {
    const view = baseView({
      filter: [
        {
          fieldKey: "floor",
          operator: "is_any_of",
          valueList: ["opt_ground", "opt_removed"],
        },
      ],
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.filter[0]?.valueList).toEqual(["opt_ground"]);
  });

  test("drops aggregations / hidden / column-order / width entries for unknown columns", () => {
    const view = baseView({
      aggregations: { name: "count", deleted_field: "sum" },
      hiddenColumns: ["col-notes", "col-gone"],
      columnOrder: ["col-name", "col-gone", "col-floor"],
      columnWidths: { "col-floor": 120, "col-gone": 80 },
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.aggregations).toEqual({ name: "count" });
    expect(result.hiddenColumns).toEqual(["col-notes"]);
    expect(result.columnOrder).toEqual(["col-name", "col-floor"]);
    expect(result.columnWidths).toEqual({ "col-floor": 120 });
  });

  test("prunes expandedGroups entries deeper than the (sanitized) group depth", () => {
    const view = baseView({
      group: [
        { fieldKey: "floor", direction: "asc" },
        { fieldKey: "deleted_group_field", direction: "asc" },
      ],
      expandedGroups: {
        '"opt_ground"': true,
        '"opt_ground"::"sub"': false,
      },
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.group.map((rule) => rule.fieldKey)).toEqual(["floor"]);
    expect(result.expandedGroups).toEqual({ '"opt_ground"': true });
  });

  test("returns a view with valid refs unchanged in semantics", () => {
    const view = baseView({
      sort: [{ fieldKey: "name", direction: "asc" }],
      filter: [
        { fieldKey: "floor", operator: "is_any_of", valueList: ["opt_ground", "opt_first"] },
      ],
      hiddenColumns: ["col-notes"],
    });
    const result = sanitizeViewStateForSchema(
      view,
      fieldDefs,
      columns as DataTableColumnDef<unknown>[],
    );
    expect(result.sort).toEqual(view.sort);
    expect(result.filter).toEqual(view.filter);
    expect(result.hiddenColumns).toEqual(view.hiddenColumns);
  });
});
