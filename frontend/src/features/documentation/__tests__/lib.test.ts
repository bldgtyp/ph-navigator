import { describe, expect, test } from "vitest";
import { filterRecord, isFullyNotApplicable, partitionFullyNotApplicableRecords } from "../lib";
import { documentationRecordFixture } from "./DocumentationSummaryView.fixtures";

describe("Documentation N/A policy", () => {
  test("recognizes only records whose three axes are N/A", () => {
    expect(isFullyNotApplicable(record("fully-na", "na", "na", "na"))).toBe(true);
    expect(isFullyNotApplicable(record("partial-na", "na", "needed", "na"))).toBe(false);
  });

  test("stable-partitions actionable records before fully N/A records", () => {
    const records = [
      record("action-1", "needed", "needed", "needed"),
      record("na-1", "na", "na", "na"),
      record("action-2", "complete", "complete", "complete"),
      record("na-2", "na", "na", "na"),
    ];

    expect(partitionFullyNotApplicableRecords(records)).toEqual({
      actionable: [records[0], records[2]],
      notApplicable: [records[1], records[3]],
    });
  });

  test("attention matching reads each raw axis independently", () => {
    const partialNa = record("partial-na", "na", "needed", "na");

    expect(filterRecord(partialNa, new Set(["datasheet"]))).toBe(true);
    expect(filterRecord(partialNa, new Set(["spec"]))).toBe(false);
    expect(filterRecord(record("fully-na", "na", "na", "na"), new Set(["datasheet"]))).toBe(false);
  });
});

function record(
  record_id: string,
  spec_status: Parameters<typeof documentationRecordFixture>[0]["spec_status"],
  datasheet_status: Parameters<typeof documentationRecordFixture>[0]["datasheet_status"],
  photo_status: Parameters<typeof documentationRecordFixture>[0]["photo_status"],
) {
  return documentationRecordFixture({
    record_id,
    display_name: record_id,
    spec_status,
    datasheet_status,
    photo_status,
  });
}
