import { describe, expect, test } from "vitest";
import { placePins } from "../components/ClimateMap";

const PROJECT = { latitude: 40, longitude: -75 };

describe("placePins", () => {
  test("maps north to the top and east to the right", () => {
    const placement = placePins(PROJECT, [
      { id: "north", latitude: 41, longitude: -75 },
      { id: "east", latitude: 40, longitude: -74 },
    ]);
    const north = placement.stations.north;
    const east = placement.stations.east;
    expect(north).toBeDefined();
    expect(east).toBeDefined();
    // North station sits higher on the map (smaller y) than the project.
    expect(north?.y).toBeLessThan(placement.project.y);
    // East station sits further right (larger x) than the project.
    expect(east?.x).toBeGreaterThan(placement.project.x);
  });

  test("centres the project when there is no spread", () => {
    const placement = placePins(PROJECT, []);
    expect(placement.project).toEqual({ x: 50, y: 50 });
  });

  test("keeps every pin inside the padded box", () => {
    const placement = placePins(PROJECT, [
      { id: "a", latitude: 45, longitude: -70 },
      { id: "b", latitude: 35, longitude: -80 },
    ]);
    for (const pin of [placement.project, ...Object.values(placement.stations)]) {
      expect(pin.x).toBeGreaterThanOrEqual(12);
      expect(pin.x).toBeLessThanOrEqual(88);
      expect(pin.y).toBeGreaterThanOrEqual(12);
      expect(pin.y).toBeLessThanOrEqual(88);
    }
  });

  test("drops stations without coordinates", () => {
    const placement = placePins(PROJECT, [
      { id: "located", latitude: 41, longitude: -75 },
      { id: "missing", latitude: null, longitude: null },
    ]);
    expect(placement.stations.located).toBeDefined();
    expect(placement.stations.missing).toBeUndefined();
  });
});
