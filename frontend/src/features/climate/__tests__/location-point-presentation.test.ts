import { describe, expect, test } from "vitest";
import { pointPresentationNote } from "../components/location-point-presentation";

describe("pointPresentationNote", () => {
  test("uses neutral copy until coordinates exist", () => {
    expect(pointPresentationNote("locality", false)).toMatch(/Choose an address or town/);
  });

  test.each([
    ["saved", "Saved project point"],
    ["address", "Address result"],
    ["locality", "Town-level location"],
    ["custom", "Custom project point"],
  ] as const)("maps %s coordinates to its privacy copy", (presentation, copy) => {
    expect(pointPresentationNote(presentation, true)).toContain(copy);
  });
});
