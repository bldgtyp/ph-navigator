import { describe, expect, test } from "vitest";
import { buildMonthlyRadiationRows, buildMonthlyTemperatureRows } from "../chart-data";
import { makeClimateRecord } from "../testing/recordFixture";

describe("buildMonthlyTemperatureRows", () => {
  test("emits 12 month rows labelled Jan…Dec", () => {
    const rows = buildMonthlyTemperatureRows(makeClimateRecord(), "SI");
    expect(rows).toHaveLength(12);
    expect(rows[0]?.month).toBe("Jan");
    expect(rows[11]?.month).toBe("Dec");
  });

  test("keeps Celsius for SI", () => {
    const rows = buildMonthlyTemperatureRows(makeClimateRecord(), "SI");
    // Fixture anchor: air_c[0] = 10.
    expect(rows[0]?.air).toBe(10);
    expect(rows[0]?.dewpoint).toBe(5);
  });

  test("converts to Fahrenheit for IP (10 °C ⇒ 50 °F)", () => {
    const rows = buildMonthlyTemperatureRows(makeClimateRecord(), "IP");
    expect(rows[0]?.air).toBe(50);
  });
});

describe("buildMonthlyRadiationRows", () => {
  test("stays SI regardless of unit system and maps every orientation", () => {
    const rows = buildMonthlyRadiationRows(makeClimateRecord());
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({
      month: "Jan",
      north: 30,
      east: 60,
      south: 90,
      west: 60,
      glob: 120,
    });
  });
});
