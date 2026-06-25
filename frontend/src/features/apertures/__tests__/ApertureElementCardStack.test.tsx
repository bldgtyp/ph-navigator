import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import { ApertureElementCardStack } from "../components/ApertureElementCardStack";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

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

function element(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: glazing(),
    operation: null,
    ...overrides,
  };
}

function aperture(overrides: Partial<ApertureTypeEntry> = {}): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "Type A",
    column_widths_mm: [1000, 1000, 1000],
    row_heights_mm: [1200],
    elements: [
      element({ id: "aptel_a", name: "A", column_span: [0, 0] }),
      element({ id: "aptel_b", name: "B", column_span: [1, 1] }),
      element({ id: "aptel_c", name: "C", column_span: [2, 2] }),
    ],
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

function StackHarness({
  entry,
  selectedElementIds,
}: {
  entry: ApertureTypeEntry;
  selectedElementIds: readonly string[];
}) {
  return (
    <UnitStub>
      <ApertureElementCardStack
        aperture={entry}
        viewDirection="exterior"
        canEdit
        selectedElementIds={selectedElementIds}
        onSetElementName={vi.fn()}
        onPickFrame={vi.fn()}
        onPickGlazing={vi.fn()}
        onSetElementOperation={vi.fn()}
        dismissedOperationWarnings={[]}
        onDismissOperationWarning={vi.fn()}
      />
    </UnitStub>
  );
}

describe("ApertureElementCardStack", () => {
  it("does not animate card movement when an element attribute changes without reordering", () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame");
    let rowHeight = 48;
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this instanceof HTMLElement && this.classList.contains("aperture-element-card")) {
        const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
        return domRect({ top: index * rowHeight, bottom: index * rowHeight + 40 });
      }
      return originalGetBoundingClientRect.call(this);
    };

    const initialEntry = aperture({
      elements: [
        element({ id: "aptel_a", name: "A", column_span: [0, 0] }),
        element({
          id: "aptel_b",
          name: "B",
          column_span: [1, 1],
          frames: { top: frame({ name: "Frame A" }), right: null, bottom: null, left: null },
        }),
        element({ id: "aptel_c", name: "C", column_span: [2, 2] }),
      ],
    });
    const updatedEntry = {
      ...initialEntry,
      elements: initialEntry.elements.map((item) =>
        item.id === "aptel_b"
          ? {
              ...item,
              frames: { ...item.frames, top: frame({ name: "Frame B", width_mm: 50 }) },
            }
          : item,
      ),
    };

    try {
      const { rerender } = render(
        <StackHarness entry={initialEntry} selectedElementIds={["aptel_b"]} />,
      );

      expect(elementCardIds()).toEqual([
        "element-card-aptel_b",
        "element-card-aptel_a",
        "element-card-aptel_c",
      ]);
      expect(requestAnimationFrame).not.toHaveBeenCalled();

      rowHeight = 54;
      rerender(<StackHarness entry={updatedEntry} selectedElementIds={["aptel_b"]} />);

      expect(elementCardIds()).toEqual([
        "element-card-aptel_b",
        "element-card-aptel_a",
        "element-card-aptel_c",
      ]);
      const frameCells = within(
        within(screen.getByTestId("element-card-aptel_b")).getByTestId("frame-row-top"),
      ).getAllByRole("cell");
      expect(frameCells[3]).toHaveTextContent("50");
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      requestAnimationFrame.mockRestore();
    }
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
