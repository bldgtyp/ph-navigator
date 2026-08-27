import { describe, expect, it } from "vitest";
import {
  applyJournaledApertureCommand,
  isJournaledApertureCommand,
  journaledApertureRowIds,
  JOURNALED_PRODUCT_FIELDS,
} from "../command-journal";
import { specReportSlice as slice } from "./spec-report-fixtures";

describe("isJournaledApertureCommand", () => {
  it("accepts evidence-only glazing and frame updates", () => {
    expect(
      isJournaledApertureCommand({
        kind: "update_project_glazing",
        project_glazing_id: "pglz_a",
        specification_status: "complete",
      }),
    ).toBe(true);
    expect(
      isJournaledApertureCommand({
        kind: "update_project_frame",
        project_frame_id: "pfrm_a",
        photo_not_required: true,
      }),
    ).toBe(true);
  });

  it("rejects removals and no-op updates", () => {
    expect(
      isJournaledApertureCommand({ kind: "remove_project_frame", project_frame_id: "pfrm_a" }),
    ).toBe(false);
    expect(
      isJournaledApertureCommand({
        kind: "update_project_glazing",
        project_glazing_id: "pglz_a",
      }),
    ).toBe(false);
  });
});

describe("applyJournaledApertureCommand", () => {
  it("patches the targeted glazing and leaves frames untouched", () => {
    const before = slice();
    const after = applyJournaledApertureCommand(before, {
      kind: "update_project_glazing",
      project_glazing_id: "pglz_b",
      specification_status: "na",
    });
    expect(after.project_glazings[1]?.specification_status).toBe("na");
    expect(after.project_glazings[0]).toBe(before.project_glazings[0]);
    expect(after.project_frames).toBe(before.project_frames);
    expect(before.project_glazings[1]?.specification_status).toBe("needed");
  });

  it("patches the targeted frame and leaves glazings untouched", () => {
    const before = slice();
    const after = applyJournaledApertureCommand(before, {
      kind: "update_project_frame",
      project_frame_id: "pfrm_a",
      specification_status: "question",
    });
    expect(after.project_frames[0]?.specification_status).toBe("question");
    expect(after.project_glazings).toBe(before.project_glazings);
  });

  it("returns the same slice when the row is gone", () => {
    const before = slice();
    expect(
      applyJournaledApertureCommand(before, {
        kind: "update_project_glazing",
        project_glazing_id: "pglz_missing",
        specification_status: "complete",
      }),
    ).toBe(before);
  });
});

describe("journaledApertureRowIds", () => {
  it("covers both tables a journaled command can target", () => {
    expect(journaledApertureRowIds(slice())).toEqual(new Set(["pglz_a", "pglz_b", "pfrm_a"]));
  });
});

// See the matching note in `features/envelope/__tests__/command-journal.test.ts`.
describe("journaled field allowlist", () => {
  it("is exactly the documentation-metadata fields", () => {
    expect([...JOURNALED_PRODUCT_FIELDS]).toEqual([
      "specification_status",
      "datasheet_not_required",
      "photo_not_required",
    ]);
  });
});
