import { describe, expect, test } from "vitest";

import type { CustomFieldDef } from "../hooks/useTableSchema";
import {
  SchemaMutationBuildError,
  buildAddFieldMutation,
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildRenameFieldMutation,
  buildSetDescriptionMutation,
} from "../lib/customFieldMutations";

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
