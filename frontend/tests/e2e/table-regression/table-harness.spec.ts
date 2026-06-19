// DataTable regression suite — harness sanity checks (Phase 01).
//
// These tests assert the *matrix is well-formed* — they do NOT drive the
// browser or touch the backend, so they run fast and have no server
// dependency. Their job is to keep the matrix honest as tables are
// added/changed and to make `playwright test --list
// tests/e2e/table-regression` enumerate one entry per target table. The
// helper module (`tableHelpers.ts`) is type-checked by `tsc -b` (tsconfig
// includes `tests`), so it needs no runtime smoke test here.
//
// Browser behavior (rendering, edits, persistence, view state) lands in
// later phases (smoke / cell-behavior / view-state specs), tagged
// `@table-smoke` / `@table-behavior` / `@table-regression`.

import { expect, test } from "@playwright/test";
import { TABLE_REGRESSION_CASES, type TableRegressionCase, tableCaseById } from "./tableMatrix";

// Independent ground truth: the 14 backend generic-table keys this suite
// targets, straight from backend/features/project_document/tables/
// registry.py. The coverage test asserts the matrix matches this exactly,
// so matrix drift from the backend registry fails at author time.
const EXPECTED_TABLE_KEYS = [
  "space_types",
  "rooms",
  "ventilators",
  "pumps",
  "fans",
  "hot_water_heaters",
  "hot_water_tanks",
  "electric_heaters",
  "appliances",
  "heat_pumps_outdoor_equip",
  "heat_pumps_indoor_equip",
  "heat_pumps_outdoor_units",
  "heat_pumps_indoor_units",
  "thermal_bridges",
];

// The keys the suite actually knows about — link targets and seed
// prerequisites must point at a table in the matrix.
const MATRIX_TABLE_KEYS = TABLE_REGRESSION_CASES.map((entry) => entry.tableKey);

const SAMPLE_PROJECT_ID = "00000000-0000-0000-0000-000000000000";
const AREAS = ["spaces", "equipment", "heat-pumps", "assets"];

test.describe("@table-harness DataTable regression matrix", () => {
  test("covers exactly the 14 target tables, keyed uniquely", () => {
    const ids = TABLE_REGRESSION_CASES.map((entry) => entry.id);

    expect(TABLE_REGRESSION_CASES).toHaveLength(EXPECTED_TABLE_KEYS.length);
    expect([...MATRIX_TABLE_KEYS].sort()).toEqual([...EXPECTED_TABLE_KEYS].sort());
    // Stable ids and table keys must each be unique across the matrix.
    expect(new Set(MATRIX_TABLE_KEYS).size).toBe(MATRIX_TABLE_KEYS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every entry has a known area; heat-pumps has four leaves", () => {
    for (const entry of TABLE_REGRESSION_CASES) {
      expect(AREAS, `${entry.id} area`).toContain(entry.area);
    }
    expect(TABLE_REGRESSION_CASES.filter((entry) => entry.area === "heat-pumps")).toHaveLength(4);
    expect(() => tableCaseById("space-types")).not.toThrow();
    expect(() => tableCaseById("does-not-exist")).toThrow();
  });

  // One enumerated check per table so `--list` shows the full matrix and
  // a failure names the offending table.
  for (const table of TABLE_REGRESSION_CASES) {
    test(`entry ${table.id} (${table.label}) is well-formed`, () => {
      assertCaseWellFormed(table);
    });
  }
});

/**
 * Structural invariants the discriminated-union types can't express.
 * (Required fields and dialog-vs-inline shape are already compile-time
 * guarantees, so they're not re-checked here.)
 */
function assertCaseWellFormed(table: TableRegressionCase): void {
  // The route is a deep link under the project namespace.
  expect(table.route(SAMPLE_PROJECT_ID), `${table.id} route`).toContain(
    `/projects/${SAMPLE_PROJECT_ID}/`,
  );

  // Headers: unique, include the identifier, and never collide with the
  // default-hidden set (hidden columns can't be asserted visible).
  expect(new Set(table.expectedHeaders).size, `${table.id} duplicate headers`).toBe(
    table.expectedHeaders.length,
  );
  expect(table.expectedHeaders, `${table.id} identifier header`).toContain(table.identifierHeader);
  for (const hidden of table.defaultHiddenHeaders ?? []) {
    expect(table.expectedHeaders, `${table.id} hidden header leak`).not.toContain(hidden);
  }

  // Every table needs at least one editable text field for the behavior matrix.
  expect(table.representativeFields.text, `${table.id} representative text field`).toBeTruthy();

  // A representative linked-record field must be described in the targets
  // map, and every target must point at a table the suite covers.
  if (table.representativeFields.linked_record) {
    expect(table.linkedRecordTargets ?? {}, `${table.id} linked-record target`).toHaveProperty(
      table.representativeFields.linked_record,
    );
  }
  for (const [fieldKey, target] of Object.entries(table.linkedRecordTargets ?? {})) {
    expect(MATRIX_TABLE_KEYS, `${table.id}.${fieldKey} target`).toContain(target.targetTableKey);
  }

  // Dialog add-rows need at least one field to fill; a seed prerequisite,
  // when present, must name a table the suite covers.
  if (table.addRow.mode === "dialog") {
    expect(table.addRow.fields.length, `${table.id} dialog fields`).toBeGreaterThan(0);
    if (table.addRow.requiresSeededTableKey) {
      expect(MATRIX_TABLE_KEYS, `${table.id} seed prerequisite`).toContain(
        table.addRow.requiresSeededTableKey,
      );
    }
  }
}
