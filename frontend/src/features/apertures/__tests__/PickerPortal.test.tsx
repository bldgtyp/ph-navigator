import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { catalogQueryKeys } from "../../catalogs/query-keys";
import type { CatalogFrameType, CatalogGlazingType } from "../../catalogs/types";
import { FramePicker } from "../components/FramePicker";
import { GlazingPicker } from "../components/GlazingPicker";

const FRAME_ROW: CatalogFrameType = {
  id: "frame_1",
  name: "Catalog Frame",
  manufacturer: "PHN",
  brand: null,
  use: null,
  operation: "Fixed",
  location: "head",
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

const GLAZING_ROW: CatalogGlazingType = {
  id: "glazing_1",
  name: "Catalog Glazing",
  manufacturer: "PHN",
  brand: null,
  suffix: null,
  u_value_w_m2k: 1,
  g_value: 0.5,
  color: null,
  source: null,
  datasheet_url: null,
  comments: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function QueryStub({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(catalogQueryKeys.frameTypesList(), { items: [FRAME_ROW] });
  queryClient.setQueryData(
    [
      ...catalogQueryKeys.frameTypesList(),
      { location: null, operation: null, manufacturers: null },
    ],
    { items: [FRAME_ROW] },
  );
  queryClient.setQueryData(catalogQueryKeys.glazingTypesList(), { items: [GLAZING_ROW] });
  queryClient.setQueryData([...catalogQueryKeys.glazingTypesList(), { manufacturers: null }], {
    items: [GLAZING_ROW],
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("Aperture pickers", () => {
  it("portals glazing picker listboxes outside the canvas container", () => {
    render(
      <QueryStub>
        <div className="aperture-canvas-container" data-testid="canvas-container">
          <GlazingPicker currentName={null} onPick={vi.fn()} />
        </div>
      </QueryStub>,
    );

    const container = screen.getByTestId("canvas-container");
    fireEvent.focus(screen.getByRole("combobox", { name: "Glazing" }));

    const listbox = screen.getByRole("listbox");
    expect(container).not.toContainElement(listbox);
    expect(document.body).toContainElement(listbox);
    expect(listbox).toHaveClass("aperture-picker__listbox");
  });

  it("portals frame picker listboxes outside the canvas container", () => {
    render(
      <QueryStub>
        <div className="aperture-canvas-container" data-testid="canvas-container">
          <FramePicker side="top" operation={null} currentName={null} onPick={vi.fn()} />
        </div>
      </QueryStub>,
    );

    const container = screen.getByTestId("canvas-container");
    fireEvent.focus(screen.getByRole("combobox", { name: "top frame" }));

    const listbox = screen.getByRole("listbox");
    expect(container).not.toContainElement(listbox);
    expect(document.body).toContainElement(listbox);
    expect(listbox).toHaveClass("aperture-picker__listbox");
  });
});
