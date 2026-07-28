import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

export function apertureElement(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    kind: "glazed",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: null, right: null, bottom: null, left: null },
    glazing: null,
    operation: null,
    ...overrides,
  };
}

export function apertureEntry(overrides: Partial<ApertureTypeEntry> = {}): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "Type A",
    column_widths_mm: [1000],
    row_heights_mm: [1200],
    elements: [apertureElement()],
    ...overrides,
  };
}

export function apertureFrame(overrides: Partial<FrameRef> = {}): FrameRef {
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

export function apertureGlazing(overrides: Partial<GlazingRef> = {}): GlazingRef {
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

export function ApertureUnitStub({
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
