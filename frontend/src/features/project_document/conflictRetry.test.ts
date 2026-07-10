import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../shared/api/client";
import { canRetryWriteMetadata } from "./conflictRetry";
import { classifyDraftConflict, draftConflictMessage } from "./lib";

const slice = { rows: [{ id: "a", name: "before", custom_values: { cf_x: 1 } }] };

describe("canRetryWriteMetadata", () => {
  it("allows untouched cell targets and collision-free inserts", () => {
    expect(
      canRetryWriteMetadata(slice.rows, [
        {
          op: {
            kind: "cell",
            writes: [{ rowId: "a", fieldKey: "name", value: "after" }],
          },
          observedBase: [{ rowId: "a", fieldKey: "name", value: "before" }],
        },
        { kind: "rowInsert", rows: [{ rowId: "b", anchorRowId: "a", fieldDefaults: {} }] },
      ]),
    ).toBe(true);
  });

  it.each([
    ["same-cell remote change", { ...slice, rows: [{ id: "a", name: "remote" }] }],
    ["deleted target row", { rows: [] }],
  ])("rejects %s", (_label, remote) => {
    expect(
      canRetryWriteMetadata(remote.rows, [
        {
          op: {
            kind: "cell",
            writes: [{ rowId: "a", fieldKey: "name", value: "after" }],
          },
          observedBase: [{ rowId: "a", fieldKey: "name", value: "before" }],
        },
      ]),
    ).toBe(false);
  });

  it("rejects insert collisions and unsupported operations", () => {
    expect(
      canRetryWriteMetadata(slice.rows, [
        { kind: "rowInsert", rows: [{ rowId: "a", anchorRowId: null, fieldDefaults: {} }] },
      ]),
    ).toBe(false);
    expect(canRetryWriteMetadata(slice.rows, [{ kind: "rowDelete", rows: [] }])).toBe(false);
  });

  it("requires valid insert anchors and unique proposed ids", () => {
    expect(
      canRetryWriteMetadata(slice.rows, [
        { kind: "rowInsert", rows: [{ rowId: "b", anchorRowId: "missing", fieldDefaults: {} }] },
      ]),
    ).toBe(false);
    expect(
      canRetryWriteMetadata(slice.rows, [
        {
          kind: "rowInsert",
          rows: [
            { rowId: "b", anchorRowId: "a", fieldDefaults: {} },
            { rowId: "b", anchorRowId: "a", fieldDefaults: {} },
          ],
        },
      ]),
    ).toBe(false);
    expect(
      canRetryWriteMetadata(slice.rows, [
        {
          kind: "rowInsert",
          rows: [
            { rowId: "b", anchorRowId: "a", fieldDefaults: {} },
            { rowId: "c", anchorRowId: "b", fieldDefaults: {} },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("compares missing values and object values structurally", () => {
    expect(
      canRetryWriteMetadata(slice.rows, [
        {
          op: {
            kind: "cell",
            writes: [{ rowId: "a", fieldKey: "missing", value: "after" }],
          },
          observedBase: [{ rowId: "a", fieldKey: "missing", value: undefined }],
        },
      ]),
    ).toBe(true);
    const withObject = { rows: [{ id: "a", custom_values: { cf_x: { a: 1, b: 2 } } }] };
    expect(
      canRetryWriteMetadata(withObject.rows, [
        {
          op: {
            kind: "cell",
            writes: [{ rowId: "a", fieldKey: "cf_x", value: null }],
          },
          observedBase: [{ rowId: "a", fieldKey: "cf_x", value: { b: 2, a: 1 } }],
        },
      ]),
    ).toBe(true);
  });

  it("classifies conflict codes and produces honest counted copy", () => {
    const conflict = (errorCode: string) =>
      new ApiRequestError(new Response(null, { status: 409 }), {
        error_code: errorCode,
        message: "Conflict",
        request_id: "req",
        details: {},
      });
    expect(classifyDraftConflict(conflict("draft_etag_mismatch"))).toBe("draft-etag");
    expect(classifyDraftConflict(conflict("version_etag_mismatch"))).toBe("version-etag");
    expect(draftConflictMessage(conflict("draft_etag_mismatch"), 2)).toContain(
      "another tab, editor, or agent",
    );
    expect(draftConflictMessage(conflict("version_etag_mismatch"), 1)).toContain(
      "1 unsaved change was discarded",
    );
  });
});
