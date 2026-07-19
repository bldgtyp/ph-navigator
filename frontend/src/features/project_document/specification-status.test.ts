import { describe, expect, it } from "vitest";
import {
  normalizeSpecificationStatus,
  normalizeSpecificationStatusRecord,
  serializeReleaseASpecificationStatus,
} from "./specification-status";

describe("Release-A specification-status response compatibility", () => {
  it.each([
    ["missing", "missing"],
    ["needed", "missing"],
    ["question", "question"],
    ["complete", "complete"],
    ["na", "na"],
  ] as const)("normalizes %s to the schema-v7 internal value %s", (wire, expected) => {
    expect(normalizeSpecificationStatus(wire)).toBe(expected);
  });

  it("normalizes only the named field and preserves the rest of a response row", () => {
    expect(
      normalizeSpecificationStatusRecord({
        id: "pglz_1",
        specification_status: "needed",
        missing_catalog_reference: true,
      }),
    ).toEqual({
      id: "pglz_1",
      specification_status: "missing",
      missing_catalog_reference: true,
    });
  });

  it("preserves row identity when the wire status is already canonical", () => {
    const row = { id: "pglz_1", specification_status: "missing" as const };

    expect(normalizeSpecificationStatusRecord(row)).toBe(row);
  });

  it("rejects unrelated wire values", () => {
    expect(() => normalizeSpecificationStatus("unknown")).toThrow(
      "Unsupported specification status: unknown",
    );
  });

  it.each(["needed", "unknown"] as const)(
    "serializes Documentation %s writes as schema-v7 missing",
    (status) => {
      expect(serializeReleaseASpecificationStatus(status)).toBe("missing");
    },
  );
});
