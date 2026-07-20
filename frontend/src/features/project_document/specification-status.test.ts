import { describe, expect, it } from "vitest";
import {
  normalizeSpecificationStatus,
  normalizeSpecificationStatusRecord,
  serializeSpecificationStatus,
} from "./specification-status";

describe("specification-status response compatibility", () => {
  it.each([
    ["needed", "needed"],
    ["missing", "needed"],
    ["question", "question"],
    ["complete", "complete"],
    ["na", "na"],
  ] as const)("normalizes %s to the canonical value %s", (wire, expected) => {
    expect(normalizeSpecificationStatus(wire)).toBe(expected);
  });

  it("normalizes only the named field and preserves the rest of a response row", () => {
    expect(
      normalizeSpecificationStatusRecord({
        id: "pglz_1",
        specification_status: "missing",
        missing_catalog_reference: true,
      }),
    ).toEqual({
      id: "pglz_1",
      specification_status: "needed",
      missing_catalog_reference: true,
    });
  });

  it("preserves row identity when the wire status is already canonical", () => {
    const row = { id: "pglz_1", specification_status: "needed" as const };

    expect(normalizeSpecificationStatusRecord(row)).toBe(row);
  });

  it("rejects unrelated wire values", () => {
    expect(() => normalizeSpecificationStatus("unknown")).toThrow(
      "Unsupported specification status: unknown",
    );
  });

  it("serializes the response-only unknown sentinel as canonical needed", () => {
    expect(serializeSpecificationStatus("unknown")).toBe("needed");
  });

  it.each(["needed", "question", "complete", "na"] as const)(
    "serializes canonical %s unchanged",
    (status) => {
      expect(serializeSpecificationStatus(status)).toBe(status);
    },
  );
});
