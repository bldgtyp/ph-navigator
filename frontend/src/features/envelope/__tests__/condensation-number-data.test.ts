import { describe, expect, test } from "vitest";
import {
  buildCondensationInterfaceRows,
  buildCondensationLayerRows,
  buildCondensationMonthlyRows,
} from "../condensation-number-data";
import {
  condensationAssembly,
  condensationMaterials,
  screenedCondensationResult,
} from "./condensation-test-fixture";

describe("condensation number data", () => {
  test("maps the selected worst path onto layer and node intermediates", () => {
    const result = screenedCondensationResult();
    const rows = buildCondensationLayerRows(
      condensationAssembly,
      condensationMaterials,
      result,
      result.monthly[0]!,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      layer: "Layer 1",
      material: "OSB",
      thicknessMm: 12,
      vaporMu: 20,
      vaporSdM: 2.4,
      temperatureC: 3,
      saturationPressurePa: 705,
      vaporPressurePa: 705,
    });
    expect(rows[1]?.material).toBe("Wood stud");
    expect(rows[1]?.vaporSdM).toBeCloseTo(0.7);
  });

  test("maps calendar criteria and preserves interface-level gc and Ma", () => {
    const result = screenedCondensationResult();
    result.monthly[0]!.surface_condensation_clear = false;

    const monthly = buildCondensationMonthlyRows(result);
    const interfaces = buildCondensationInterfaceRows(
      condensationAssembly,
      condensationMaterials,
      result,
    );

    expect(monthly).toHaveLength(12);
    expect(monthly[0]).toMatchObject({
      monthName: "January",
      condensationRateKgM2S: 1e-9,
      accumulatedMoistureGM2: 28,
      interfaceCount: 1,
      surfaceState: "Review",
      moldState: "Clear",
    });
    expect(interfaces[0]).toMatchObject({
      monthName: "January",
      interface: "OSB / Wood stud",
      condensationRateKgM2S: 1e-9,
      moistureChangeGM2: 28,
      accumulatedMoistureGM2: 28,
    });
  });
});
