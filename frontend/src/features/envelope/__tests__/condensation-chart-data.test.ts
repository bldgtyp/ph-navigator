import { describe, expect, test } from "vitest";
import {
  buildLayerLabelMap,
  buildMoistureChartRows,
  buildPressureProfileRows,
  buildTemperatureProfileRows,
  defaultProfileMonth,
  monthByNumber,
} from "../condensation-chart-data";
import {
  condensationAssembly,
  condensationMaterials,
  screenedCondensationResult,
} from "./condensation-test-fixture";

describe("condensation chart data", () => {
  test("maps the golden monthly result into a calendar-ordered Ma curve", () => {
    const result = screenedCondensationResult();
    result.monthly.reverse();

    const rows = buildMoistureChartRows(result);

    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      month: 1,
      monthName: "January",
      monthLabel: "Jan",
      accumulatedMoisture: 28,
      moistureChange: 28,
    });
    expect(rows[2]?.accumulatedMoisture).toBe(84);
    expect(rows[11]?.monthName).toBe("December");
    expect(defaultProfileMonth(result)).toBe(3);
  });

  test("maps sd and physical-thickness profiles without hiding a membrane-like span", () => {
    const result = screenedCondensationResult();
    const month = monthByNumber(result, 1);
    if (!month) throw new Error("Expected January.");
    const labels = buildLayerLabelMap(
      condensationAssembly,
      condensationMaterials,
      result.worst_path_id,
    );

    const sd = buildPressureProfileRows(month, "sd", labels);
    const thickness = buildPressureProfileRows(month, "thickness", labels);
    const temperature = buildTemperatureProfileRows(month, "thickness");

    expect(labels.get("layer-insulation")).toBe("Wood stud");
    expect(sd.map((row) => row.position)).toEqual([0, 2.4, 3.1]);
    expect(thickness.map((row) => row.position)).toEqual([0, 0.012, 0.152]);
    expect(sd[1]).toMatchObject({
      vaporPressure: 705,
      saturationPressure: 705,
      interfaceLabel: "OSB / Wood stud",
      isCondensing: true,
    });
    expect(temperature.at(-1)).toEqual({
      nodeIndex: 2,
      position: 0.152,
      temperature: 16,
    });
  });
});
