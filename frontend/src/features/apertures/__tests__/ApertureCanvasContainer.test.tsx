import { fireEvent, render, screen } from "@testing-library/react";
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
  const value: UnitPreferenceContextValue = {
    unitSystem: "SI",
    source: "default",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>;
}

function ApertureCanvasHarness({ entry }: { entry: ApertureTypeEntry }) {
  const dimFormat = useApertureDimFormat();

  return (
    <>
      <details className="app-subtabs__menu-wrap" open>
        <summary>Aperture actions</summary>
        <div className="app-subtabs__menu" role="menu">
          <DisplayFormatMenuGroup {...dimFormat} />
        </div>
      </details>
      <ApertureCanvasContainer aperture={entry} dimFormat={dimFormat} canEdit />
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

    fireEvent.click(screen.getByText("Dimension display"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Centimeters (cm)" }));

    expect(screen.getByTestId("aperture-total-dim-caption")).toHaveTextContent(
      "180.00 cm × 120.00 cm",
    );
    expect(screen.getByTestId("col-w-0-value")).toHaveTextContent("100.00");
    expect(screen.getByTestId("row-h-0-value")).toHaveTextContent("120.00");
  });
});
