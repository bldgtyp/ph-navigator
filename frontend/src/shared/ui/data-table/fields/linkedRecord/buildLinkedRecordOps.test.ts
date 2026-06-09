import { describe, expect, it, vi } from "vitest";
import { buildLinkedRecordOps } from "./buildLinkedRecordOps";
import type { FieldDef } from "../../types";

type PumpRow = { id: string; record_id: string | null; display: string };

function makeField(field_key: string, target: string[], max_links: number | null = null): FieldDef {
  return {
    field_key,
    display_name: field_key,
    field_type: "linked_record",
    is_custom: true,
    linked_record_config: { target_table_path: target, max_links },
  } as unknown as FieldDef;
}

function makeOtherField(field_key: string, field_type: FieldDef["field_type"]): FieldDef {
  return {
    field_key,
    display_name: field_key,
    field_type,
    is_custom: true,
  } as unknown as FieldDef;
}

describe("buildLinkedRecordOps", () => {
  const pumps: PumpRow[] = [
    { id: "row_a", record_id: "P-001", display: "Booster A" },
    { id: "row_b", record_id: "P-002", display: "Booster B" },
    { id: "row_c", record_id: null, display: "Unassigned" },
  ];

  it("only emits entries for linked_record fields whose target matches", () => {
    const ops = buildLinkedRecordOps({
      fieldDefs: [
        makeField("cf_pumps", ["pumps"]),
        makeField("cf_vents", ["ventilators"]),
        makeOtherField("cf_text", "text"),
      ],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
    });

    expect(Array.from(ops.keys())).toEqual(["cf_pumps"]);
  });

  it("resolves rowId to recordId; returns null for unknown rowIds", () => {
    const ops = buildLinkedRecordOps({
      fieldDefs: [makeField("cf_pumps", ["pumps"])],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
    });

    const entry = ops.get("cf_pumps");
    expect(entry).toBeDefined();
    expect(entry!.resolve("row_a")).toEqual({ recordId: "P-001" });
    expect(entry!.resolve("row_c")).toEqual({ recordId: null });
    expect(entry!.resolve("row_missing")).toBeNull();
  });

  it("populates candidates with displayName when getDisplayName is provided", () => {
    const ops = buildLinkedRecordOps({
      fieldDefs: [makeField("cf_pumps", ["pumps"])],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
      getDisplayName: (p) => p.display,
    });

    const candidates = ops.get("cf_pumps")!.candidates;
    expect(candidates).toEqual([
      { rowId: "row_a", recordId: "P-001", displayName: "Booster A" },
      { rowId: "row_b", recordId: "P-002", displayName: "Booster B" },
      { rowId: "row_c", recordId: null, displayName: "Unassigned" },
    ]);
  });

  it("forwards onPillClick when supplied; omits the key otherwise", () => {
    const onPillClick = vi.fn();
    const withHook = buildLinkedRecordOps({
      fieldDefs: [makeField("cf_pumps", ["pumps"])],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
      onPillClick,
    });
    withHook.get("cf_pumps")!.onPillClick!("row_a");
    expect(onPillClick).toHaveBeenCalledWith("row_a");

    const withoutHook = buildLinkedRecordOps({
      fieldDefs: [makeField("cf_pumps", ["pumps"])],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
    });
    expect(withoutHook.get("cf_pumps")!.onPillClick).toBeUndefined();
  });

  it("returns an empty Map when no fields target the supplied path", () => {
    const ops = buildLinkedRecordOps({
      fieldDefs: [makeField("cf_vents", ["ventilators"])],
      targetTablePath: ["pumps"],
      targetRows: pumps,
      getRowId: (p) => p.id,
      getRecordId: (p) => p.record_id,
    });
    expect(ops.size).toBe(0);
  });
});
