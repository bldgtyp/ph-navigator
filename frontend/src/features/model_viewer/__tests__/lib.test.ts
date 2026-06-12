import { describe, expect, test } from "vitest";
import {
  HBJSON_SIZE_REJECTION_MESSAGE,
  HBJSON_TYPE_REJECTION_MESSAGE,
  formatFileSizeMb,
  sortFilesNewestFirst,
  validateHbjsonFile,
} from "../lib";
import type { HbjsonFile } from "../types";

const MB = 1024 * 1024;

function file(overrides: Partial<HbjsonFile>): HbjsonFile {
  return {
    id: "f1",
    project_id: "p1",
    asset_id: "a1",
    display_name: "model",
    notes: null,
    uploaded_by: "u1",
    uploaded_by_display_name: "Ed",
    uploaded_at: "2026-06-12T10:00:00Z",
    size_bytes: 1024,
    original_filename: "model.hbjson",
    extraction_status: "pending",
    extraction_error: null,
    ...overrides,
  };
}

describe("validateHbjsonFile", () => {
  test("accepts .hbjson and .json, case-insensitive", () => {
    expect(validateHbjsonFile({ name: "model.hbjson", size: MB })).toBeNull();
    expect(validateHbjsonFile({ name: "Model.HBJSON", size: MB })).toBeNull();
    expect(validateHbjsonFile({ name: "export.json", size: MB })).toBeNull();
  });

  test("rejects other extensions with the US-VIEW-1 message", () => {
    expect(validateHbjsonFile({ name: "model.txt", size: MB })).toBe(HBJSON_TYPE_REJECTION_MESSAGE);
    expect(validateHbjsonFile({ name: "model", size: MB })).toBe(HBJSON_TYPE_REJECTION_MESSAGE);
  });

  test("enforces the 100 MB cap (D-17), inclusive at the boundary", () => {
    expect(validateHbjsonFile({ name: "big.hbjson", size: 100 * MB })).toBeNull();
    expect(validateHbjsonFile({ name: "big.hbjson", size: 100 * MB + 1 })).toBe(
      HBJSON_SIZE_REJECTION_MESSAGE,
    );
  });
});

describe("sortFilesNewestFirst", () => {
  test("orders by uploaded_at descending", () => {
    const older = file({ id: "older", uploaded_at: "2026-06-10T10:00:00Z" });
    const newer = file({ id: "newer", uploaded_at: "2026-06-12T10:00:00Z" });
    expect(sortFilesNewestFirst([older, newer]).map((item) => item.id)).toEqual(["newer", "older"]);
  });
});

describe("formatFileSizeMb", () => {
  test("renders one decimal place", () => {
    expect(formatFileSizeMb(14.2 * MB)).toBe("14.2 MB");
    expect(formatFileSizeMb(459 * 1024)).toBe("0.4 MB");
  });
});
