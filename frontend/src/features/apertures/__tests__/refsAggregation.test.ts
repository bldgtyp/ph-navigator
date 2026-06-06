import { describe, expect, it } from "vitest";
import { aggregateFrameRefs, aggregateGlazingRefs } from "../lib/refsAggregation";
import type { ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

function frame(recordId: string | null, name = "F"): FrameRef {
  return {
    name,
    manufacturer: "ABC",
    operation: "Fixed",
    location: "head",
    width_mm: 80,
    u_value_w_m2k: 1,
    psi_g_w_mk: 0.04,
    catalog_origin: recordId
      ? {
          catalog_table: "frame_types",
          catalog_record_id: recordId,
          catalog_version_id: null,
          catalog_schema_version: 1,
          synced_at: "2026-01-01T00:00:00Z",
          local_overrides: [],
        }
      : null,
  } as unknown as FrameRef;
}

function glazing(recordId: string | null, name = "G"): GlazingRef {
  return {
    name,
    manufacturer: "Alpen",
    u_value_w_m2k: 0.8,
    g_value: 0.5,
    catalog_origin: recordId
      ? {
          catalog_table: "glazing_types",
          catalog_record_id: recordId,
          catalog_version_id: null,
          catalog_schema_version: 1,
          synced_at: "2026-01-01T00:00:00Z",
          local_overrides: [],
        }
      : null,
  } as unknown as GlazingRef;
}

function aperture(opts: {
  id?: string;
  frame: FrameRef | null;
  glazing?: GlazingRef | null;
  elements?: number;
}): ApertureTypeEntry {
  const elementCount = opts.elements ?? 1;
  return {
    id: opts.id ?? "apt_X",
    name: opts.id ?? "apt_X",
    row_heights_mm: [1000],
    column_widths_mm: [1000],
    elements: Array.from({ length: elementCount }).map((_, i) => ({
      id: `aptel_${opts.id ?? "X"}_${i}`,
      name: `E${i}`,
      row_span: [0, 0],
      column_span: [0, 0],
      frames: {
        top: opts.frame,
        right: opts.frame,
        bottom: opts.frame,
        left: opts.frame,
      },
      glazing: opts.glazing ?? null,
      operation: null,
    })),
  };
}

describe("aggregateFrameRefs", () => {
  it("dedupes catalog-sourced refs by catalog_record_id", () => {
    const f = frame("recCAT00000001");
    const refs = aggregateFrameRefs([
      aperture({ id: "apt_A", frame: f }),
      aperture({ id: "apt_B", frame: f }),
    ]);
    expect(refs).toHaveLength(1);
    // Two apertures × 4 sides per element × 1 element = 8 usages.
    expect(refs[0]?.usages).toHaveLength(8);
    expect(refs[0]?.origin).toBe("catalog");
    expect(refs[0]?.catalogRecordId).toBe("recCAT00000001");
  });

  it("lists hand-entered refs individually (one per side / occurrence)", () => {
    const handFrame = frame(null);
    const refs = aggregateFrameRefs([aperture({ id: "apt_A", frame: handFrame })]);
    // 4 sides → 4 separate hand-entered rows
    expect(refs).toHaveLength(4);
    for (const r of refs) {
      expect(r.origin).toBe("hand_enter");
      expect(r.catalogRecordId).toBeNull();
      expect(r.usages).toHaveLength(1);
    }
  });

  it("skips empty slots", () => {
    expect(aggregateFrameRefs([aperture({ frame: null })])).toEqual([]);
  });
});

describe("aggregateGlazingRefs", () => {
  it("dedupes glazings by record_id and tallies usage count", () => {
    const g = glazing("recGLZ0000000001");
    const refs = aggregateGlazingRefs([
      aperture({ id: "apt_A", frame: null, glazing: g, elements: 2 }),
      aperture({ id: "apt_B", frame: null, glazing: g, elements: 1 }),
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.usages).toHaveLength(3);
  });

  it("lists hand-entered glazings individually", () => {
    const refs = aggregateGlazingRefs([
      aperture({ id: "apt_A", frame: null, glazing: glazing(null) }),
      aperture({ id: "apt_B", frame: null, glazing: glazing(null) }),
    ]);
    expect(refs).toHaveLength(2);
  });
});
