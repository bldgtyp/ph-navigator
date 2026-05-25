import { describe, expect, test } from "vitest";

import type { CustomFieldDef } from "../hooks/useTableSchema";
import {
  SchemaMutationBuildError,
  buildAddFieldMutation,
  buildChangeTypeMutation,
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildEditOptionsMutation,
  buildRenameFieldMutation,
  buildSetDescriptionMutation,
  buildSetFormulaMutation,
} from "../lib/customFieldMutations";
import { SOURCE_LENGTH_MAX } from "../lib/formula";

const SAMPLE_FIELD: CustomFieldDef = {
  id: "cf_sample",
  field_key: null,
  display_name: "Notes",
  field_type: "short_text",
  config: {},
  description: null,
  created_at: "2026-05-24T12:00:00Z",
  created_by: null,
};

describe("buildAddFieldMutation", () => {
  test("produces the wire shape when no anchor is given", () => {
    const op = buildAddFieldMutation({
      tableKey: "rooms",
      newField: SAMPLE_FIELD,
      insertAfterFieldId: null,
      schemaFingerprint: "fp-1",
    });
    expect(op).toEqual({
      kind: "addField",
      tableKey: "rooms",
      after: SAMPLE_FIELD,
      expectedSchemaFingerprint: "fp-1",
    });
    // `insertAfterFieldId` is omitted (not set to null) so the JSON wire
    // payload matches the Pydantic `AddFieldMutation` default.
    expect("insertAfterFieldId" in op).toBe(false);
  });

  test("includes the anchor when provided", () => {
    const op = buildAddFieldMutation({
      tableKey: "rooms",
      newField: SAMPLE_FIELD,
      insertAfterFieldId: "cf_other",
      schemaFingerprint: "fp-2",
    });
    expect(op.insertAfterFieldId).toBe("cf_other");
  });

  test("rejects an empty display_name", () => {
    expect(() =>
      buildAddFieldMutation({
        tableKey: "rooms",
        newField: { ...SAMPLE_FIELD, display_name: "   " },
        insertAfterFieldId: null,
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });

  test("rejects a malformed cf_* id", () => {
    expect(() =>
      buildAddFieldMutation({
        tableKey: "rooms",
        newField: { ...SAMPLE_FIELD, id: "notvalid" },
        insertAfterFieldId: null,
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });

  test("rejects a malformed anchor id", () => {
    expect(() =>
      buildAddFieldMutation({
        tableKey: "rooms",
        newField: SAMPLE_FIELD,
        insertAfterFieldId: "not_a_cf_id",
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildRenameFieldMutation", () => {
  test("trims the display_name and produces the wire shape", () => {
    const op = buildRenameFieldMutation({
      tableKey: "rooms",
      fieldId: "cf_x",
      displayName: "  New Name  ",
      schemaFingerprint: "fp",
    });
    expect(op).toEqual({
      kind: "renameField",
      tableKey: "rooms",
      fieldId: "cf_x",
      displayName: "New Name",
      expectedSchemaFingerprint: "fp",
    });
  });

  test("rejects an empty display_name", () => {
    expect(() =>
      buildRenameFieldMutation({
        tableKey: "rooms",
        fieldId: "cf_x",
        displayName: "",
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildDeleteFieldMutation", () => {
  test("pins `clearValues: true` on the wire shape", () => {
    const op = buildDeleteFieldMutation({
      tableKey: "rooms",
      fieldId: "cf_x",
      schemaFingerprint: "fp",
    });
    expect(op).toEqual({
      kind: "deleteField",
      tableKey: "rooms",
      fieldId: "cf_x",
      clearValues: true,
      expectedSchemaFingerprint: "fp",
    });
  });
});

describe("buildDuplicateFieldMutation", () => {
  test("produces the wire shape with a fresh target id", () => {
    const op = buildDuplicateFieldMutation({
      tableKey: "rooms",
      sourceFieldId: "cf_src",
      newField: { ...SAMPLE_FIELD, id: "cf_dup", display_name: "Notes copy" },
      schemaFingerprint: "fp",
    });
    expect(op).toEqual({
      kind: "duplicateField",
      tableKey: "rooms",
      sourceFieldId: "cf_src",
      after: { ...SAMPLE_FIELD, id: "cf_dup", display_name: "Notes copy" },
      expectedSchemaFingerprint: "fp",
    });
  });

  test("rejects when target id equals source id", () => {
    expect(() =>
      buildDuplicateFieldMutation({
        tableKey: "rooms",
        sourceFieldId: "cf_src",
        newField: { ...SAMPLE_FIELD, id: "cf_src", display_name: "Notes copy" },
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildSetDescriptionMutation", () => {
  test("trims and clamps the description", () => {
    const tooLong = "x".repeat(400);
    const op = buildSetDescriptionMutation({
      tableKey: "rooms",
      fieldId: "cf_x",
      description: `  ${tooLong}  `,
      schemaFingerprint: "fp",
    });
    expect(op.description?.length).toBe(280);
  });

  test("normalises empty/whitespace input to null", () => {
    const op = buildSetDescriptionMutation({
      tableKey: "rooms",
      fieldId: "cf_x",
      description: "   ",
      schemaFingerprint: "fp",
    });
    expect(op.description).toBeNull();
  });

  test("passes null through unchanged", () => {
    const op = buildSetDescriptionMutation({
      tableKey: "rooms",
      fieldId: "cf_x",
      description: null,
      schemaFingerprint: "fp",
    });
    expect(op).toEqual({
      kind: "setDescription",
      tableKey: "rooms",
      fieldId: "cf_x",
      description: null,
      expectedSchemaFingerprint: "fp",
    });
  });
});

describe("buildEditOptionsMutation", () => {
  test("produces a typed editOptions mutation", () => {
    const op = buildEditOptionsMutation({
      tableKey: "rooms",
      fieldId: "cf_status",
      nextOptions: [
        { id: "opt_a", label: "Open", color: "#3b82f6", order: 1 },
        { id: "opt_b", label: "Closed", color: "#10b981", order: 2 },
      ],
      schemaFingerprint: "fp",
    });
    expect(op.kind).toBe("editOptions");
    expect(op.fieldId).toBe("cf_status");
    expect(op.nextOptions).toHaveLength(2);
  });

  test("rejects duplicate labels (case-insensitive trimmed)", () => {
    expect(() =>
      buildEditOptionsMutation({
        tableKey: "rooms",
        fieldId: "cf_status",
        nextOptions: [
          { id: "opt_a", label: "Open", color: "#3b82f6", order: 1 },
          { id: "opt_b", label: " open ", color: "#10b981", order: 2 },
        ],
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });

  test("rejects malformed color", () => {
    expect(() =>
      buildEditOptionsMutation({
        tableKey: "rooms",
        fieldId: "cf_status",
        nextOptions: [{ id: "opt_a", label: "Open", color: "not-a-color", order: 1 }],
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildChangeTypeMutation", () => {
  test("produces a typed changeType mutation preserving identity", () => {
    const after: CustomFieldDef = { ...SAMPLE_FIELD, field_type: "number" };
    const op = buildChangeTypeMutation({
      tableKey: "rooms",
      fieldId: SAMPLE_FIELD.id,
      after,
      acknowledgeDestructive: true,
      schemaFingerprint: "fp",
    });
    expect(op.kind).toBe("changeType");
    expect(op.acknowledgeDestructive).toBe(true);
    expect(op.after.field_type).toBe("number");
  });

  test("rejects identity mismatch", () => {
    const after: CustomFieldDef = { ...SAMPLE_FIELD, id: "cf_other" };
    expect(() =>
      buildChangeTypeMutation({
        tableKey: "rooms",
        fieldId: SAMPLE_FIELD.id,
        after,
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildAddFieldMutation initialOptions (Phase 3 P3.5)", () => {
  test("attaches initialOptions for single_select fields", () => {
    const op = buildAddFieldMutation({
      tableKey: "rooms",
      newField: { ...SAMPLE_FIELD, field_type: "single_select" },
      insertAfterFieldId: null,
      initialOptions: [{ id: "opt_a", label: "A", color: "#3b82f6", order: 1 }],
      schemaFingerprint: "fp",
    });
    expect(op.initialOptions).toHaveLength(1);
  });

  test("rejects initialOptions on a non-single_select field", () => {
    expect(() =>
      buildAddFieldMutation({
        tableKey: "rooms",
        newField: SAMPLE_FIELD,
        insertAfterFieldId: null,
        initialOptions: [{ id: "opt_a", label: "A", color: "#3b82f6", order: 1 }],
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});

describe("buildSetFormulaMutation", () => {
  test("produces the typed wire shape", () => {
    const op = buildSetFormulaMutation({
      tableKey: "rooms",
      fieldId: "cf_formula",
      source: 'concat({Number}, " — ", upper({Name}))',
      schemaFingerprint: "fp",
    });
    expect(op).toEqual({
      kind: "setFormula",
      tableKey: "rooms",
      fieldId: "cf_formula",
      source: 'concat({Number}, " — ", upper({Name}))',
      expectedSchemaFingerprint: "fp",
    });
  });

  test("rejects an empty source", () => {
    expect(() =>
      buildSetFormulaMutation({
        tableKey: "rooms",
        fieldId: "cf_formula",
        source: "   ",
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });

  test("rejects a source longer than SOURCE_LENGTH_MAX", () => {
    expect(() =>
      buildSetFormulaMutation({
        tableKey: "rooms",
        fieldId: "cf_formula",
        source: "x".repeat(SOURCE_LENGTH_MAX + 1),
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });

  test("rejects a non-cf_* fieldId", () => {
    expect(() =>
      buildSetFormulaMutation({
        tableKey: "rooms",
        fieldId: "name",
        source: "upper({Name})",
        schemaFingerprint: "fp",
      }),
    ).toThrow(SchemaMutationBuildError);
  });
});
