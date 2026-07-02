import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { catalogQueryKeys } from "../../catalogs/query-keys";
import type { CatalogFrameType } from "../../catalogs/types";
import { FramePicker } from "../components/FramePicker";
import { FramePickerFilterProvider } from "../hooks/useFramePickerFilters";
import type { ApertureOperation } from "../types";

const ROWS = [
  frameRow("head-fixed", "Head Fixed", "Head", "Fixed"),
  frameRow("jamb-inswing", "Jamb Inswing", "Jamb", "Inswing"),
  frameRow("sill-sliding", "Sill Sliding", "Sill", "Sliding"),
  frameRow("any-casement", "Any Casement", "Any", "Casement"),
  frameRow("mullh-double", "Mull-H Double-Hung", "Mull-H", "Double-Hung"),
  frameRow("mullv-double", "Mull-V Double-Hung", "Mull-V", "Double-Hung"),
  frameRow("head-tilt", "Head Tilt-Turn", "Head", "Tilt-Turn"),
  frameRow("head-awning", "Head Awning", "Head", "Awning"),
  frameRow("head-hopper", "Head Hopper", "Head", "Hopper"),
  frameRow("head-unknown", "Head Unknown", "Head", "Pivot"),
];

function PickerHarness({
  children,
  filterFramesBySide = true,
  filterFramesByOperation = false,
}: {
  children: ReactNode;
  filterFramesBySide?: boolean;
  filterFramesByOperation?: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(catalogQueryKeys.frameTypesList(), { items: ROWS });
  queryClient.setQueryData(
    [
      ...catalogQueryKeys.frameTypesList(),
      { location: null, operation: null, manufacturers: null },
    ],
    { items: ROWS },
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FramePickerFilterProvider value={{ filterFramesBySide, filterFramesByOperation }}>
        {children}
      </FramePickerFilterProvider>
    </QueryClientProvider>
  );
}

function renderPicker({
  side = "top",
  operation = null,
  currentName = null,
  currentCatalogId = null,
  filterFramesBySide = true,
  filterFramesByOperation = false,
}: {
  side?: "top" | "right" | "bottom" | "left";
  operation?: ApertureOperation | null;
  currentName?: string | null;
  currentCatalogId?: string | null;
  filterFramesBySide?: boolean;
  filterFramesByOperation?: boolean;
} = {}) {
  render(
    <PickerHarness
      filterFramesBySide={filterFramesBySide}
      filterFramesByOperation={filterFramesByOperation}
    >
      <FramePicker
        side={side}
        operation={operation}
        currentName={currentName}
        currentCatalogId={currentCatalogId}
        onPick={vi.fn()}
      />
    </PickerHarness>,
  );
  fireEvent.focus(screen.getByRole("combobox", { name: `${side} frame` }));
}

describe("FramePicker filter engine", () => {
  it("defaults to side filtering and includes Any and Mull-H rows for top pickers", () => {
    renderPicker();

    expect(screen.getByRole("option", { name: /Head Fixed/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Any Casement/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-H Double-Hung/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Jamb Inswing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sill Sliding/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mull-V Double-Hung/ })).not.toBeInTheDocument();
  });

  it("uses Jamb, Mull-V, and Any for side pickers", () => {
    renderPicker({ side: "right" });

    expect(screen.getByRole("option", { name: /Jamb Inswing/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Any Casement/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-V Double-Hung/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Head Fixed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Mull-H Double-Hung/ })).not.toBeInTheDocument();
  });

  it("shows all locations when side filtering is off", () => {
    renderPicker({ filterFramesBySide: false });

    expect(screen.getByRole("option", { name: /Head Fixed/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Jamb Inswing/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Sill Sliding/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-H Double-Hung/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-V Double-Hung/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Any Casement/ })).toBeInTheDocument();
  });

  it("shows all operation labels when operation filtering is off", () => {
    renderPicker({ filterFramesBySide: false, operation: { type: "swing", directions: [] } });

    expect(screen.getByRole("option", { name: /Head Fixed/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Sill Sliding/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Head Unknown/ })).toBeInTheDocument();
  });

  it("narrows swing operation filtering to swing-family rows", () => {
    renderPicker({
      filterFramesBySide: false,
      filterFramesByOperation: true,
      operation: { type: "swing", directions: [] },
    });

    expect(screen.getByRole("option", { name: /Jamb Inswing/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Any Casement/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Head Tilt-Turn/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Head Awning/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Head Hopper/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-H Double-Hung/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-V Double-Hung/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Head Fixed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sill Sliding/ })).not.toBeInTheDocument();
  });

  it("narrows slide operation filtering to Sliding and Double-Hung", () => {
    renderPicker({
      filterFramesBySide: false,
      filterFramesByOperation: true,
      operation: { type: "slide", directions: [] },
    });

    expect(screen.getByRole("option", { name: /Sill Sliding/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-H Double-Hung/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Mull-V Double-Hung/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Any Casement/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Head Fixed/ })).not.toBeInTheDocument();
  });

  it("keeps the selected row visible when filters would otherwise hide it", () => {
    renderPicker({
      currentCatalogId: "sill-sliding",
      currentName: "Sill Sliding",
      operation: null,
      filterFramesBySide: true,
      filterFramesByOperation: true,
    });

    expect(screen.getByRole("option", { name: /Sill Sliding/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Head Fixed/ })).toBeInTheDocument();
  });
});

function frameRow(
  id: string,
  name: string,
  location: string | null,
  operation: string | null,
): CatalogFrameType {
  return {
    id,
    name,
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
