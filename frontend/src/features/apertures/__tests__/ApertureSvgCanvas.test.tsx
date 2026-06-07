import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApertureSvgCanvas } from "../components/ApertureSvgCanvas";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

function frame(widthMm: number, color: string | null = null): FrameRef {
  return {
    name: "F",
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: widthMm,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function glazing(color: string | null = null): GlazingRef {
  return {
    name: "G",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function element(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: {
      top: frame(50),
      right: frame(50),
      bottom: frame(50),
      left: frame(50),
    },
    glazing: glazing(),
    operation: null,
    ...overrides,
  };
}

function entry(overrides: Partial<ApertureTypeEntry> = {}): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "Type A",
    column_widths_mm: [1000],
    row_heights_mm: [1000],
    elements: [element()],
    ...overrides,
  };
}

describe("ApertureSvgCanvas", () => {
  it("renders an svg with the document viewBox", () => {
    render(
      <ApertureSvgCanvas
        aperture={entry({ column_widths_mm: [1000, 2000], row_heights_mm: [1500] })}
        zoom={1}
        viewDirection="exterior"
      />,
    );
    const svg = screen.getByTestId("aperture-svg-canvas");
    expect(svg.getAttribute("viewBox")).toBe("0 0 3000 1500");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("Type A");
  });

  it("renders five regions per element (top, right, bottom, left, glazing)", () => {
    render(<ApertureSvgCanvas aperture={entry()} zoom={1} viewDirection="exterior" />);
    const group = screen.getByTestId("element-aptel_1");
    expect(within(group).getByTestId("region-aptel_1-top")).toBeInTheDocument();
    expect(within(group).getByTestId("region-aptel_1-right")).toBeInTheDocument();
    expect(within(group).getByTestId("region-aptel_1-bottom")).toBeInTheDocument();
    expect(within(group).getByTestId("region-aptel_1-left")).toBeInTheDocument();
    expect(within(group).getByTestId("region-aptel_1-glazing")).toBeInTheDocument();
  });

  it("marks a null-frame region with dashed stroke and no fill", () => {
    const el = element({
      frames: { top: null, right: frame(50), bottom: frame(50), left: frame(50) },
    });
    render(
      <ApertureSvgCanvas aperture={entry({ elements: [el] })} zoom={1} viewDirection="exterior" />,
    );
    const topRegion = screen.getByTestId("region-aptel_1-top");
    expect(topRegion.getAttribute("fill")).toBe("none");
    expect(topRegion.getAttribute("stroke-width")).toBe("0.5");
    expect(topRegion.getAttribute("stroke-dasharray")).toBe("4,3");
    expect(topRegion.getAttribute("data-region-null")).toBe("true");
  });

  it("uses the glazing diagram fill token instead of the catalog color", () => {
    const el = element({ glazing: glazing("#aabbcc") });
    render(
      <ApertureSvgCanvas aperture={entry({ elements: [el] })} zoom={1} viewDirection="exterior" />,
    );
    expect(screen.getByTestId("region-aptel_1-glazing").getAttribute("fill")).toBe(
      "var(--aperture-glazing-default-fill)",
    );
  });

  it("uses the frame diagram fill token instead of the catalog color", () => {
    const el = element({
      frames: {
        top: frame(50, "#aabbcc"),
        right: frame(50),
        bottom: frame(50),
        left: frame(50),
      },
    });
    render(
      <ApertureSvgCanvas aperture={entry({ elements: [el] })} zoom={1} viewDirection="exterior" />,
    );
    expect(screen.getByTestId("region-aptel_1-top").getAttribute("fill")).toBe(
      "var(--aperture-frame-default-fill)",
    );
    expect(screen.getByTestId("region-aptel_1-top").getAttribute("stroke-width")).toBe("0.5");
  });

  it("renders swing operation lines with a heavier dashed stroke", () => {
    const el = element({
      operation: { type: "swing", directions: ["left"] },
    });
    const { container } = render(
      <ApertureSvgCanvas aperture={entry({ elements: [el] })} zoom={1} viewDirection="exterior" />,
    );
    const lines = Array.from(
      container.querySelectorAll('[data-testid="operation-symbols-aptel_1"] line[data-direction]'),
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.getAttribute("stroke-width")).toBe("8");
      expect(line.getAttribute("stroke-dasharray")).toBe("20,10");
    }
  });

  it("flips column order for the interior view direction", () => {
    const a = element({ id: "aptel_a", column_span: [0, 0] });
    const b = element({ id: "aptel_b", column_span: [1, 1] });
    const c = element({ id: "aptel_c", column_span: [2, 2] });
    const aperture = entry({
      column_widths_mm: [100, 200, 300],
      row_heights_mm: [1000],
      elements: [a, b, c],
    });
    render(<ApertureSvgCanvas aperture={aperture} zoom={1} viewDirection="interior" />);
    // Interior view mirrors columns: element `a` (originally at col 0, x=0)
    // now renders at x = (100 + 200) = 300; element `c` renders at x = 0.
    const aGroup = screen.getByTestId("element-aptel_a");
    const cGroup = screen.getByTestId("element-aptel_c");
    const aGlazing = within(aGroup).getByTestId("region-aptel_a-glazing");
    const cGlazing = within(cGroup).getByTestId("region-aptel_c-glazing");
    expect(Number(aGlazing.getAttribute("x"))).toBeGreaterThan(Number(cGlazing.getAttribute("x")));
  });

  it("renders proportionally: px width/height matches mm width/height ratio", () => {
    render(
      <ApertureSvgCanvas
        aperture={entry({ column_widths_mm: [2000, 4000], row_heights_mm: [2000] })}
        zoom={1}
        viewDirection="exterior"
      />,
    );
    const svg = screen.getByTestId("aperture-svg-canvas");
    const w = Number(svg.getAttribute("width"));
    const h = Number(svg.getAttribute("height"));
    expect(w / h).toBeCloseTo(3.0, 5);
  });
});
