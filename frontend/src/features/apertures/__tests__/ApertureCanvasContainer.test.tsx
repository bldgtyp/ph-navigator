import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { DisplayFormatMenuGroup } from "../components/DisplayFormatSelector";
import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElement, ApertureTypeEntry } from "../types";

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

function UnitStub({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value: UnitPreferenceContextValue = {
    unitSystem: "SI",
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
    selectionByAperture: {},
    hoveredElementId: null,
    hoveredRegion: null,
    pickPasteMode: "idle",
    pickedAssignment: null,
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
