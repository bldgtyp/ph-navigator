import { describe, expect, test } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import fixture from "../__fixtures__/assembly-report-parity.json";
import { buildAssemblyReportPage } from "../assembly-report";
import type { Assembly, ProjectMaterial } from "../types";

describe("buildAssemblyReportPage", () => {
  test("matches the backend parity fixture", () => {
    expect(
      buildAssemblyReportPage(
        fixture.assembly as unknown as Assembly,
        fixture.materials as unknown as ProjectMaterial[],
        fixture.units as UnitSystem,
      ),
    ).toEqual(fixture.expected);
  });

  test("normalizes valid out-of-order arrays and matches the explicit rounding policy", () => {
    const assembly = fixture.assembly as unknown as Assembly;
    const materials = fixture.materials as unknown as ProjectMaterial[];
    const outOfOrder = {
      ...assembly,
      layers: [...assembly.layers]
        .reverse()
        .map((layer) => ({ ...layer, segments: [...layer.segments].reverse() })),
    };

    const ordered = buildAssemblyReportPage(outOfOrder, materials, "SI");
    const rounding = buildAssemblyReportPage(
      {
        ...assembly,
        layers: assembly.layers.map((layer, index) =>
          index === 0 ? { ...layer, thickness_mm: fixture.rounding_cases.length_mm } : layer,
        ),
      },
      materials,
      "SI",
    );

    expect(ordered.layers.map((layer) => layer.layer_id)).toEqual(
      fixture.expected.layers.map((layer) => layer.layer_id),
    );
    expect(ordered.layers[0]?.segments.map((segment) => segment.segment_id)).toEqual([
      "seg_insulation_a",
      "seg_missing",
    ]);
    expect(rounding.layers[0]?.thickness_label).toBe(fixture.rounding_cases.expected_si);
  });
});
