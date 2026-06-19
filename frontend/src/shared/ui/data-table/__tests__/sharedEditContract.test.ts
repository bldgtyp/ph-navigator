import { describe, expect, test } from "vitest";
import {
  decideSingleSelectCommit,
  planCommit,
  planLinkedRecord,
  type EditingCell,
  type EditorState,
} from "../hooks/useGridEdit";
import type { FieldDef } from "../types";

// ---------------------------------------------------------------------------
// Shared DataTable edit contract — the single source of truth for the
// commit-time write/undo contract that EVERY route's editable cell rides
// through (planning/features/data-table-regression-suite, Phase 02).
//
// These tests exercise the PURE commit planners directly — no React, no
// jsdom — so the forward/inverse op pairing is pinned independently of
// the hook wiring (`useGridEdit`) and the rendered grid. The browser
// matrix (Phases 03–05) can therefore assume the low-level edit contract
// is already proven here and only verify that each route wires it up.
//
// Traceability — where each Phase 02 contract behavior is verified once:
//
//   1. Text edit commit ............ here (§Text) + useGridEdit.test.ts
//   2. Numeric commit + units ...... here (§Number) + numberUnitsGrid.test.tsx:269
//   3. Nullable clear → null ....... here (§Text/§Number) + lib.test.ts:275
//                                    + rowDefaultsColor.test.ts (color)
//   4. Required-clear rejection .... here (§Text/§Number) + lib.test.ts:305
//                                    (single_select clear rejects via the
//                                    coerce/Delete path, not the popover)
//   5. Single-select existing ...... here (§Single-select) + SingleSelectPopover.test.tsx
//   6. Single-select create ........ here (§Single-select — incl. the
//                                    inverse `removedOptions` that
//                                    useGridEdit.test.ts:334 leaves implicit)
//   7. Linked-record dedupe/cap .... here (§Linked-record) + linkedRecordPaste.test.ts
//   8. Stable cell selectors ....... GridBody.test.tsx:57 (DOM-level)
//   9. Unit-field display .......... numberUnitsGrid.test.tsx:94 (DOM-level)
//
// Behaviors 8–9 are observable only through the rendered grid, so they
// stay in their DOM specs above; they are listed here so this file reads
// as the complete contract index.
// ---------------------------------------------------------------------------

// A canonical SI-mode commit. The number+units round-trip test overrides
// the unit system inline.
const UNIT_SYSTEM = "SI" as const;

const ROW_ID = "rm_1";
const FIELD_KEY = "f";

// Build the EditingCell a planner receives. `fieldKey` is fixed to the
// shared FieldDef key below so the emitted op carries a realistic key.
function editing(editor: EditorState, originalValue: unknown): EditingCell {
  return { rowId: ROW_ID, fieldKey: FIELD_KEY, originalValue, editor };
}

function cellWrite(value: unknown) {
  return { kind: "cell" as const, writes: [{ rowId: ROW_ID, fieldKey: FIELD_KEY, value }] };
}

describe("shared edit contract — Text", () => {
  const textField: FieldDef = { field_key: FIELD_KEY, field_type: "text", display_name: "Name" };

  test("commit emits the forward write and its exact paired inverse", () => {
    const plan = planCommit(
      editing({ kind: "text", draftValue: "Annex" }, "Living"),
      textField,
      UNIT_SYSTEM,
    );
    expect(plan).toEqual({
      kind: "dispatch",
      op: cellWrite("Annex"),
      inverse: cellWrite("Living"),
    });
  });

  test("commit with an unchanged value is a no-op (no write)", () => {
    expect(
      planCommit(editing({ kind: "text", draftValue: "Living" }, "Living"), textField, UNIT_SYSTEM),
    ).toEqual({
      kind: "noop",
    });
  });

  test("blank on a nullable field clears to null — never the empty string", () => {
    const plan = planCommit(
      editing({ kind: "text", draftValue: "" }, "Living"),
      textField,
      UNIT_SYSTEM,
    );
    expect(plan).toEqual({ kind: "dispatch", op: cellWrite(null), inverse: cellWrite("Living") });
    const written =
      plan.kind === "dispatch" && plan.op.kind === "cell" ? plan.op.writes[0]?.value : "unset";
    expect(written).toBeNull();
    expect(written).not.toBe("");
  });

  test("blank on a required field is rejected with no write", () => {
    expect(
      planCommit(
        editing({ kind: "text", draftValue: "" }, "Living"),
        { ...textField, required: true },
        UNIT_SYSTEM,
      ),
    ).toEqual({ kind: "invalid", message: "Value required." });
  });
});

describe("shared edit contract — Number", () => {
  const numberField: FieldDef = {
    field_key: FIELD_KEY,
    field_type: "number",
    display_name: "People",
  };

  test("commit parses the draft string to a finite number", () => {
    const plan = planCommit(
      editing({ kind: "number", draftValue: "7" }, 2),
      numberField,
      UNIT_SYSTEM,
    );
    expect(plan).toEqual({ kind: "dispatch", op: cellWrite(7), inverse: cellWrite(2) });
  });

  test("blank on a nullable field clears to null — never 0", () => {
    const plan = planCommit(
      editing({ kind: "number", draftValue: "" }, 2),
      numberField,
      UNIT_SYSTEM,
    );
    const written =
      plan.kind === "dispatch" && plan.op.kind === "cell" ? plan.op.writes[0]?.value : "unset";
    expect(written).toBeNull();
    expect(written).not.toBe(0);
  });

  test("a non-numeric draft is rejected with no write", () => {
    expect(
      planCommit(editing({ kind: "number", draftValue: "abc" }, 2), numberField, UNIT_SYSTEM),
    ).toEqual({
      kind: "invalid",
      message: "Expected a number.",
    });
  });

  test("a number+units field round-trips the displayed value back to canonical SI", () => {
    const lengthField: FieldDef = {
      field_key: FIELD_KEY,
      field_type: "number",
      display_name: "Thickness",
      numberUnits: {
        mode: "editable",
        unit_type: "length",
        si_unit: "m",
        ip_unit: "ft",
        precision_si: 3,
        precision_ip: 2,
      },
    };
    // In IP mode the editor draft is the displayed feet value; commit must
    // store the canonical SI metre value (10 ft = 3.048 m).
    const plan = planCommit(editing({ kind: "number", draftValue: "10" }, 0), lengthField, "IP");
    expect(plan.kind).toBe("dispatch");
    const written =
      plan.kind === "dispatch" && plan.op.kind === "cell" ? plan.op.writes[0]?.value : undefined;
    expect(written).toBeCloseTo(3.048, 6);
  });
});

describe("shared edit contract — Single-select", () => {
  const options = [
    { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
    { id: "opt_mez", label: "Mezzanine", color: "#10b981", order: 1 },
  ];
  const selectField: FieldDef = {
    field_key: FIELD_KEY,
    field_type: "single_select",
    display_name: "Floor",
    options,
  };

  test("a highlighted option id wins over the search text", () => {
    expect(
      decideSingleSelectCommit({ searchText: "ignored", highlightedOptionId: "opt_mez" }, options),
    ).toEqual({
      kind: "existing",
      optionId: "opt_mez",
    });
  });

  test("a search string resolves to a matching option, case-insensitively", () => {
    expect(
      decideSingleSelectCommit({ searchText: "ground", highlightedOptionId: null }, options),
    ).toEqual({
      kind: "existing",
      optionId: "opt_ground",
    });
  });

  test("a blank search with no highlight is a no-op (the popover cannot commit empty)", () => {
    expect(
      decideSingleSelectCommit({ searchText: "  ", highlightedOptionId: null }, options),
    ).toEqual({
      kind: "noop",
    });
  });

  test("an unmatched search string plans a new option", () => {
    const decision = decideSingleSelectCommit(
      { searchText: "Penthouse", highlightedOptionId: null },
      options,
    );
    expect(decision.kind).toBe("create");
    if (decision.kind !== "create") throw new Error("expected create");
    expect(decision.created.label).toBe("Penthouse");
    expect(decision.optionId).toBe(decision.created.id);
  });

  test("commit to an existing option emits a plain cell op with no option delta", () => {
    const plan = planCommit(
      editing(
        { kind: "single_select", searchText: "", highlightedOptionId: "opt_mez" },
        "opt_ground",
      ),
      selectField,
      UNIT_SYSTEM,
    );
    expect(plan).toEqual({
      kind: "dispatch",
      op: cellWrite("opt_mez"),
      inverse: cellWrite("opt_ground"),
    });
  });

  test("commit equal to the current option is a no-op", () => {
    expect(
      planCommit(
        editing(
          { kind: "single_select", searchText: "", highlightedOptionId: "opt_ground" },
          "opt_ground",
        ),
        selectField,
        UNIT_SYSTEM,
      ),
    ).toEqual({ kind: "noop" });
  });

  test("create carries newOptions forward AND removedOptions on the inverse (undo drops the minted option)", () => {
    const plan = planCommit(
      editing(
        { kind: "single_select", searchText: "Penthouse", highlightedOptionId: null },
        "opt_ground",
      ),
      selectField,
      UNIT_SYSTEM,
    );
    expect(plan.kind).toBe("dispatch");
    if (plan.kind !== "dispatch" || plan.op.kind !== "cell" || plan.inverse.kind !== "cell") {
      throw new Error("expected a cell dispatch");
    }
    const created = plan.op.newOptions?.[FIELD_KEY]?.[0];
    expect(created?.label).toBe("Penthouse");
    expect(plan.op.writes[0]?.value).toBe(created?.id);
    // The genuinely under-asserted half: ⌘Z must remove the freshly
    // minted option, so the inverse names it in removedOptions.
    expect(plan.inverse.writes[0]?.value).toBe("opt_ground");
    expect(plan.inverse.removedOptions?.[FIELD_KEY]).toEqual([created?.id]);
  });
});

describe("shared edit contract — Linked-record", () => {
  const multiLink: FieldDef = {
    field_key: FIELD_KEY,
    field_type: "linked_record",
    display_name: "Pumps",
    linked_record_config: { target_table_path: ["equipment", "pumps"], max_links: null },
  };
  const singleLink: FieldDef = {
    field_key: FIELD_KEY,
    field_type: "linked_record",
    display_name: "Pump",
    linked_record_config: { target_table_path: ["equipment", "pumps"], max_links: 1 },
  };

  test("commit dedupes the id list and pairs an inverse of the originals", () => {
    const plan = planLinkedRecord(
      editing({ kind: "linked_record" }, ["pmp_a"]),
      ["pmp_b", "pmp_b", "pmp_c"],
      multiLink,
    );
    expect(plan).toEqual({
      kind: "dispatch",
      op: cellWrite(["pmp_b", "pmp_c"]),
      inverse: cellWrite(["pmp_a"]),
    });
  });

  test("commit with the same id sequence is a no-op", () => {
    expect(
      planLinkedRecord(
        editing({ kind: "linked_record" }, ["pmp_a", "pmp_b"]),
        ["pmp_a", "pmp_b"],
        multiLink,
      ),
    ).toEqual({ kind: "noop" });
  });

  test("commit past max_links is rejected with no write", () => {
    expect(
      planLinkedRecord(editing({ kind: "linked_record" }, []), ["pmp_a", "pmp_b"], singleLink),
    ).toEqual({
      kind: "invalid",
      message: "Pump accepts at most 1 link.",
    });
  });

  test("the generic commit path is inert for a linked_record editor — commitLinkedRecord owns it", () => {
    expect(
      planCommit(editing({ kind: "linked_record" }, ["pmp_a"]), multiLink, UNIT_SYSTEM),
    ).toEqual({
      kind: "noop",
    });
  });
});
