import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { DisplayFormatMenuGroup } from "../components/DisplayFormatSelector";
import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";
import type { UnitSystem } from "../../../lib/units";

function element(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
    operation: null,
    ...overrides,
  };
}

function aperture(overrides: Partial<ApertureTypeEntry> = {}): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "Type A",
    column_widths_mm: [1000],
    row_heights_mm: [1200],
    elements: [element()],
    ...overrides,
  };
}

function UnitStub({
  children,
  unitSystem = "SI",
}: {
  children: ReactNode;
  unitSystem?: UnitSystem;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value: UnitPreferenceContextValue = {
    unitSystem,
    source: "default",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return (
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
    </QueryClientProvider>
  );
}

function frame(overrides: Partial<FrameRef> = {}): FrameRef {
  return {
    name: "Frame A",
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 25.4,
    u_value_w_m2k: 1,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    ...overrides,
  };
}

function glazing(overrides: Partial<GlazingRef> = {}): GlazingRef {
  return {
    name: "Glazing A",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: 1,
    g_value: 0.5,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    ...overrides,
  };
}

function ApertureCanvasHarness({
  entry,
  onEditDimension,
  onSetElementName,
}: {
  entry: ApertureTypeEntry;
  onEditDimension?: (axis: "row" | "column", index: number, newMm: number) => void;
  onSetElementName?: (elementId: string, newName: string) => void;
}) {
  const dimFormat = useApertureDimFormat();

  return (
    <>
      <DisplayFormatMenuGroup {...dimFormat} />
      <ApertureCanvasContainer
        aperture={entry}
        dimFormat={dimFormat}
        canEdit
        onEditDimension={onEditDimension}
        onSetElementName={onSetElementName}
      />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useApertureBuilderStore.setState({
    canvasZoom: 1,
    hasCanvasZoom: false,
    selectionByAperture: {},
    hoveredElementId: null,
    hoveredRegion: null,
    pickPasteMode: "idle",
    pickedAssignment: null,
    undoStacksByAperture: {},
    dismissedOperationWarnings: {},
  });
});

describe("ApertureCanvasContainer", () => {
  it("applies the selected SI dimension display format to captions and labels", () => {
    render(
      <UnitStub>
        <ApertureCanvasHarness
          entry={aperture({
            column_widths_mm: [1000, 800],
            row_heights_mm: [1200],
            elements: [
              element({ id: "aptel_1", column_span: [0, 0] }),
              element({ id: "aptel_2", column_span: [1, 1] }),
            ],
          })}
        />
      </UnitStub>,
    );

    expect(screen.getByTestId("aperture-total-dim-caption")).toHaveTextContent(
      "1800.0 mm × 1200.0 mm",
    );
    expect(screen.getByTestId("col-w-0-value")).toHaveTextContent("1000.0");
    expect(screen.getByTestId("row-h-0-value")).toHaveTextContent("1200.0");

    fireEvent.click(screen.getByRole("button", { name: "Dimension display" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Centimeters (cm)" }));

    expect(screen.getByTestId("aperture-total-dim-caption")).toHaveTextContent(
      "180.00 cm × 120.00 cm",
    );
    expect(screen.getByTestId("col-w-0-value")).toHaveTextContent("100.00");
    expect(screen.getByTestId("row-h-0-value")).toHaveTextContent("120.00");
  });

  it("renders the total dimension caption before the canvas toolbar", () => {
    render(
      <UnitStub>
        <ApertureCanvasHarness entry={aperture()} />
      </UnitStub>,
    );

    const caption = screen.getByTestId("aperture-total-dim-caption");
    const toolbar = screen.getByRole("toolbar", { name: "Aperture canvas tools" });

    expect(caption.compareDocumentPosition(toolbar)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("preserves the user zoom level when switching aperture types", () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    clientWidthSpy.mockReturnValue(500);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get");
    clientHeightSpy.mockReturnValue(500);

    try {
      const { rerender } = render(
        <UnitStub>
          <ApertureCanvasHarness entry={aperture({ id: "apt_1", name: "Type A" })} />
        </UnitStub>,
      );

      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("300%");

      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("200%");

      rerender(
        <UnitStub>
          <ApertureCanvasHarness entry={aperture({ id: "apt_2", name: "Type B" })} />
        </UnitStub>,
      );

      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("200%");
    } finally {
      clientWidthSpy.mockRestore();
      clientHeightSpy.mockRestore();
    }
  });

  it("preserves the user zoom level after the canvas unmounts and remounts", () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    clientWidthSpy.mockReturnValue(500);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, "clientHeight", "get");
    clientHeightSpy.mockReturnValue(500);

    try {
      const { rerender } = render(
        <UnitStub>
          <ApertureCanvasHarness entry={aperture({ id: "apt_1", name: "Type A" })} />
        </UnitStub>,
      );

      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("300%");
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("200%");

      rerender(<UnitStub>{null}</UnitStub>);
      rerender(
        <UnitStub>
          <ApertureCanvasHarness entry={aperture({ id: "apt_1", name: "Type A" })} />
        </UnitStub>,
      );

      expect(screen.getByTestId("aperture-canvas-zoom")).toHaveTextContent("200%");
    } finally {
      clientWidthSpy.mockRestore();
      clientHeightSpy.mockRestore();
    }
  });

  it("renames an element card through the inline edit controls", () => {
    const onSetElementName = vi.fn();
    render(
      <UnitStub>
        <ApertureCanvasHarness
          entry={aperture({ elements: [element({ id: "aptel_named", name: "A" })] })}
          onSetElementName={onSetElementName}
        />
      </UnitStub>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename A" }));
    fireEvent.change(screen.getByLabelText("Element name"), { target: { value: "A-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(onSetElementName).toHaveBeenCalledWith("aptel_named", "A-1");
  });

  it("updates element-card frame and glazing metrics when the app unit system changes", () => {
    const entry = aperture({
      elements: [
        element({
          glazing: glazing(),
          frames: { top: frame(), right: null, bottom: null, left: null },
        }),
      ],
    });

    const { rerender } = render(
      <UnitStub unitSystem="SI">
        <ApertureCanvasHarness entry={entry} onSetElementName={vi.fn()} />
      </UnitStub>,
    );

    expect(screen.getByRole("columnheader", { name: "U-Value [W/(m2-K)]" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Width [mm]" })).toBeInTheDocument();
    expect(within(screen.getByTestId("glazing-row")).getAllByRole("cell")[2]).toHaveTextContent(
      "1",
    );
    const frameCellsSi = within(screen.getByTestId("frame-row-top")).getAllByRole("cell");
    expect(frameCellsSi[2]).toHaveTextContent("1");
    expect(frameCellsSi[3]).toHaveTextContent("25.4");

    rerender(
      <UnitStub unitSystem="IP">
        <ApertureCanvasHarness entry={entry} onSetElementName={vi.fn()} />
      </UnitStub>,
    );

    expect(
      screen.getByRole("columnheader", { name: "U-Value [Btu/(h-ft2-F)]" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Width [in]" })).toBeInTheDocument();
    expect(within(screen.getByTestId("glazing-row")).getAllByRole("cell")[2]).toHaveTextContent(
      "0.176",
    );
    const frameCellsIp = within(screen.getByTestId("frame-row-top")).getAllByRole("cell");
    expect(frameCellsIp[2]).toHaveTextContent("0.176");
    expect(frameCellsIp[3]).toHaveTextContent("1");
  });

  it("clears element selection on Escape", () => {
    render(
      <UnitStub>
        <ApertureCanvasHarness
          entry={aperture({
            elements: [
              element({ id: "aptel_a", column_span: [0, 0] }),
              element({ id: "aptel_b", column_span: [1, 1] }),
            ],
            column_widths_mm: [1000, 1000],
          })}
        />
      </UnitStub>,
    );

    fireEvent.click(screen.getByTestId("hit-aptel_a-glazing"));
    fireEvent.click(screen.getByTestId("hit-aptel_b-glazing"), { shiftKey: true });
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([
      "aptel_a",
      "aptel_b",
    ]);

    fireEvent.keyDown(screen.getByTestId("aperture-canvas-container"), { key: "Escape" });

    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([]);
  });

  it("bubbles the latest selected element card without scrolling the page", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const scrollIntoView = vi.fn();
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.classList.contains("aperture-element-card")) {
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
        return domRect({ top: index * 48, bottom: index * 48 + 40 });
      }
      return originalGetBoundingClientRect.call(this);
    };

    try {
      render(
        <UnitStub>
          <ApertureCanvasHarness
            entry={aperture({
              elements: [
                element({ id: "aptel_a", name: "A", column_span: [0, 0] }),
                element({ id: "aptel_b", name: "B", column_span: [1, 1] }),
                element({ id: "aptel_c", name: "C", column_span: [2, 2] }),
              ],
              column_widths_mm: [1000, 1000, 1000],
            })}
            onSetElementName={vi.fn()}
          />
        </UnitStub>,
      );

      expect(elementCardIds()).toEqual([
        "element-card-aptel_a",
        "element-card-aptel_b",
        "element-card-aptel_c",
      ]);

      fireEvent.click(screen.getByTestId("hit-element-aptel_b"));
      expect(elementCardIds()).toEqual([
        "element-card-aptel_b",
        "element-card-aptel_a",
        "element-card-aptel_c",
      ]);
      expect(screen.getByTestId("element-card-aptel_b")).toHaveAttribute("data-selected", "true");
      expect(screen.getByTestId("element-card-aptel_a")).not.toHaveAttribute("data-selected");
      expect(requestAnimationFrame).toHaveBeenCalled();
      expect(screen.getByTestId("element-card-aptel_b")).toHaveAttribute("data-moving", "true");
      expect(screen.getByTestId("element-card-aptel_b")).toHaveStyle({
        transform: "translate(0, 0)",
      });

      fireEvent.click(screen.getByTestId("hit-element-aptel_c"), { shiftKey: true });
      expect(elementCardIds()).toEqual([
        "element-card-aptel_c",
        "element-card-aptel_a",
        "element-card-aptel_b",
      ]);
      expect(screen.getByTestId("element-card-aptel_b")).toHaveAttribute("data-selected", "true");
      expect(screen.getByTestId("element-card-aptel_c")).toHaveAttribute("data-selected", "true");

      fireEvent.keyDown(screen.getByTestId("aperture-canvas-container"), { key: "Escape" });
      expect(elementCardIds()).toEqual([
        "element-card-aptel_a",
        "element-card-aptel_b",
        "element-card-aptel_c",
      ]);
      expect(screen.getByTestId("element-card-aptel_b")).not.toHaveAttribute("data-selected");
      expect(screen.getByTestId("element-card-aptel_c")).not.toHaveAttribute("data-selected");
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      requestAnimationFrame.mockRestore();
    }
  });

  it("cancels an element card name edit when focus leaves the editor", () => {
    const onSetElementName = vi.fn();
    render(
      <UnitStub>
        <ApertureCanvasHarness
          entry={aperture({ elements: [element({ id: "aptel_named", name: "A" })] })}
          onSetElementName={onSetElementName}
        />
      </UnitStub>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename A" }));
    const input = screen.getByLabelText("Element name");
    fireEvent.change(input, { target: { value: "A-1" } });
    fireEvent.blur(input, { relatedTarget: document.body });

    expect(onSetElementName).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Element name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename A" })).toBeInTheDocument();
  });

  it("flips horizontal dimension strip with the interior SVG view", () => {
    const onEditDimension = vi.fn();
    render(
      <UnitStub>
        <ApertureCanvasHarness
          entry={aperture({
            column_widths_mm: [100, 200, 300],
            row_heights_mm: [1000],
            elements: [
              element({ id: "aptel_a", column_span: [0, 0] }),
              element({ id: "aptel_b", column_span: [1, 1] }),
              element({ id: "aptel_c", column_span: [2, 2] }),
            ],
          })}
          onEditDimension={onEditDimension}
        />
      </UnitStub>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Viewing from Exterior" }));

    const visualLeft = screen.getByTestId("col-w-0");
    const visualRight = screen.getByTestId("col-w-2");
    const visualMiddle = screen.getByTestId("col-w-1");
    const tick1 = screen.getByTestId("col-tick-1");
    expect(screen.getByTestId("col-w-0-value")).toHaveTextContent("300.0");
    expect(screen.getByTestId("col-w-2-value")).toHaveTextContent("100.0");
    expect(visualLeft).toHaveStyle({ left: "0px" });
    expect(parseFloat(visualLeft.style.width)).toBeGreaterThan(parseFloat(visualRight.style.width));
    expect(parseFloat(tick1.style.left)).toBeCloseTo(parseFloat(visualLeft.style.width), 5);
    expect(parseFloat(visualRight.style.left)).toBeCloseTo(
      parseFloat(visualLeft.style.width) + parseFloat(visualMiddle.style.width),
      5,
    );

    fireEvent.click(screen.getByTestId("col-w-0-value"));
    fireEvent.change(screen.getByTestId("col-w-0-input"), { target: { value: "350" } });
    fireEvent.keyDown(screen.getByTestId("col-w-0-input"), { key: "Enter" });
    expect(onEditDimension).toHaveBeenCalledWith("column", 2, 350);
  });
});

function elementCardIds(): string[] {
  return Array.from(screen.getByTestId("aperture-element-card-stack").children).map((child) => {
    const testId = child.getAttribute("data-testid");
    if (!testId) throw new Error("Element card is missing data-testid.");
    return testId;
  });
}

function domRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    x: overrides.x ?? 0,
    y: overrides.y ?? overrides.top ?? 0,
    width: overrides.width ?? 320,
    height: overrides.height ?? 40,
    top: overrides.top ?? 0,
    right: overrides.right ?? 320,
    bottom: overrides.bottom ?? 40,
    left: overrides.left ?? 0,
    toJSON: () => ({}),
  } as DOMRect;
}
