import { describe, expect, it } from "vitest";
import {
  EVIDENCE_STATUSES,
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
  needAttentionLabel,
  normalizeSpecificationStatus,
  normalizeSpecificationStatusRecord,
  resolvedLabel,
  serializeSpecificationStatus,
} from "./specification-status";

describe("specification-status response compatibility", () => {
  it("owns the three-axis labels, tooltips, and rollup phrases", () => {
    expect(STATUS_AXIS_LABELS).toEqual({
      spec: { column: "Spec. Status", meter: "Spec. Status", filter: "Needs spec" },
      datasheet: { column: "Datasheet", meter: "Datasheets", filter: "Needs datasheet" },
      photo: { column: "Site Photos", meter: "Site Photos", filter: "Needs site photos" },
    });
    expect(STATUS_AXIS_TOOLTIPS.spec).toContain("Design specification");
    expect(STATUS_AXIS_TOOLTIPS.datasheet).toContain("Manufacturer datasheet PDF");
    expect(STATUS_AXIS_TOOLTIPS.photo).toContain("Installed-condition photos");
    expect(EVIDENCE_STATUSES).toEqual(["needed", "complete", "na"]);
    expect(needAttentionLabel(3)).toBe("3 need attention");
    expect(resolvedLabel(2, 3)).toBe("2 of 3 resolved");
  });

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
