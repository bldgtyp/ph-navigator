import { describe, expect, it } from "vitest";
import {
  filterFrameRows,
  frameLocationMatchesSide,
  frameOperationMatchesElement,
  locationForSide,
  operationFamilyForElement,
  operationForElement,
  sideLocationFamily,
} from "../picker-filters";
import type { CatalogFrameType } from "../../catalogs/types";

describe("locationForSide", () => {
  it("maps top → head, bottom → sill, sides → jamb", () => {
    expect(locationForSide("top")).toBe("head");
    expect(locationForSide("bottom")).toBe("sill");
    expect(locationForSide("left")).toBe("jamb");
    expect(locationForSide("right")).toBe("jamb");
  });
});

describe("operationForElement", () => {
  it("returns Fixed for null operation", () => {
    expect(operationForElement(null)).toEqual({ type: "Fixed", directions: [] });
  });

  it("capitalises directions and maps swing→Swing / slide→Slide", () => {
    expect(operationForElement({ type: "swing", directions: ["left", "up"] })).toEqual({
      type: "Swing",
      directions: ["Left", "Up"],
    });
    expect(operationForElement({ type: "slide", directions: ["right"] })).toEqual({
      type: "Slide",
      directions: ["Right"],
    });
  });
});

describe("sideLocationFamily", () => {
  it("includes Any in every side family", () => {
    expect(sideLocationFamily("top")).toEqual(["Head", "Any"]);
    expect(sideLocationFamily("right")).toEqual(["Jamb", "Any"]);
    expect(sideLocationFamily("bottom")).toEqual(["Sill", "Any"]);
    expect(sideLocationFamily("left")).toEqual(["Jamb", "Any"]);
  });

  it("matches locations case-insensitively but not null locations", () => {
    expect(frameLocationMatchesSide("head", "top")).toBe(true);
    expect(frameLocationMatchesSide("Any", "top")).toBe(true);
    expect(frameLocationMatchesSide("Sill", "top")).toBe(false);
    expect(frameLocationMatchesSide(null, "top")).toBe(false);
  });
});

describe("operationFamilyForElement", () => {
  it("returns fixed, swing, and slide operation families", () => {
    expect(operationFamilyForElement(null)).toEqual(["Fixed"]);
    expect(operationFamilyForElement({ type: "swing", directions: [] })).toEqual([
      "Swing",
      "Inswing",
      "Outswing",
      "Casement",
      "Awning",
      "Hopper",
      "Tilt-Turn",
      "Double-Hung",
    ]);
    expect(operationFamilyForElement({ type: "slide", directions: [] })).toEqual([
      "Slide",
      "Sliding",
      "Double-Hung",
    ]);
  });

  it("normalizes operation labels and matches Double-Hung to swing and slide", () => {
    expect(frameOperationMatchesElement("tilt turn", { type: "swing", directions: [] })).toBe(true);
    expect(frameOperationMatchesElement("double_hung", { type: "swing", directions: [] })).toBe(
      true,
    );
    expect(frameOperationMatchesElement("Double Hung", { type: "slide", directions: [] })).toBe(
      true,
    );
    expect(frameOperationMatchesElement("Fixed", { type: "slide", directions: [] })).toBe(false);
    expect(frameOperationMatchesElement(null, { type: "slide", directions: [] })).toBe(false);
  });
});

describe("filterFrameRows", () => {
  it("applies side and operation filters only when enabled", () => {
    const rows = [
      row("head-fixed", "Head", "Fixed"),
      row("any-casement", "Any", "Casement"),
      row("sill-sliding", "Sill", "Sliding"),
      row("mull-double", "Mull-H", "Double-Hung"),
    ];

    expect(
      filterFrameRows(rows, {
        side: "top",
        operation: { type: "swing", directions: [] },
        filterFramesBySide: true,
        filterFramesByOperation: true,
      }).map((item) => item.id),
    ).toEqual(["any-casement"]);

    expect(
      filterFrameRows(rows, {
        side: "top",
        operation: { type: "swing", directions: [] },
        filterFramesBySide: false,
        filterFramesByOperation: false,
      }).map((item) => item.id),
    ).toEqual(["head-fixed", "any-casement", "sill-sliding", "mull-double"]);
  });
});

function row(id: string, location: string | null, operation: string | null): CatalogFrameType {
  return {
    id,
    name: id,
    manufacturer: "PHN",
    brand: null,
    use: null,
    operation,
    location,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 50,
    u_value_w_m2k: 1.5,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    datasheet_url: null,
    comments: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}
