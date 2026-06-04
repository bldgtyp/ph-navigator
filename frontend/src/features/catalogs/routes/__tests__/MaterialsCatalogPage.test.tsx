import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { AuthSession } from "../../../auth/types";
import * as api from "../../api";
import type { CatalogMaterial } from "../../types";
import { MaterialsCatalogPage } from "../MaterialsCatalogPage";

type MockMaterialRow = { id: string };

vi.mock("../../../../shared/ui/data-table", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/ui/data-table")>(
    "../../../../shared/ui/data-table",
  );
  return {
    ...actual,
    DataTable: ({
      rows,
      onRowOpen,
    }: {
      rows: MockMaterialRow[];
      onRowOpen?: (row: MockMaterialRow) => void;
    }) => (
      <div data-testid="materials-grid">
        <button type="button" onClick={() => rows[0] && onRowOpen?.(rows[0])}>
          Expand first material
        </button>
      </div>
    ),
  };
});

const SESSION: AuthSession = {
  user: {
    id: "user_1",
    email: "ed@example.com",
    display_name: "Ed May",
    units_preference: "SI",
  },
  expires_at: "2026-06-04T12:00:00Z",
};

const WOOD_FIBER: CatalogMaterial = {
  id: "mat_1",
  name: "Wood fiber board",
  category: "insulation",
  density_kg_m3: null,
  specific_heat_j_kgk: null,
  conductivity_w_mk: 0.038,
  emissivity: null,
  color: null,
  source: null,
  url: null,
  comments: null,
  is_active: true,
  created_at: "2026-06-04T12:00:00Z",
  updated_at: "2026-06-04T12:00:00Z",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider
        value={{
          unitSystem: "SI",
          source: "default",
          error: null,
          setUnitSystem: vi.fn(),
          toggleUnitSystem: vi.fn(),
        }}
      >
        <MemoryRouter>
          <MaterialsCatalogPage session={SESSION} />
        </MemoryRouter>
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
}

describe("MaterialsCatalogPage", () => {
  test("opens the new material modal from the top-left action", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "listMaterials").mockResolvedValue({ items: [] });
    vi.spyOn(api, "createMaterial").mockResolvedValue(WOOD_FIBER);

    renderPage();

    expect(screen.queryByRole("heading", { name: "Materials" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Curated starting library/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New Material +" }));
    expect(screen.getByRole("dialog", { name: "New material" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Wood fiber board");
    await user.type(screen.getByLabelText(/Lambda/), "0.038");
    await user.click(screen.getByRole("button", { name: "Create material" }));

    await waitFor(() => {
      expect(api.createMaterial).toHaveBeenCalledWith({
        name: "Wood fiber board",
        category: "insulation",
        density_kg_m3: null,
        specific_heat_j_kgk: null,
        conductivity_w_mk: 0.038,
        emissivity: null,
        color: null,
        source: null,
        url: null,
        comments: null,
      });
    });
  });

  test("opens the edit modal from the table expand gutter", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "listMaterials").mockResolvedValue({ items: [WOOD_FIBER] });
    vi.spyOn(api, "updateMaterial").mockResolvedValue({
      ...WOOD_FIBER,
      name: "Dense wood fiber board",
    });

    renderPage();

    await screen.findByText("1 material");
    await user.click(await screen.findByRole("button", { name: "Expand first material" }));
    expect(screen.getByRole("dialog", { name: "Edit material" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Wood fiber board");
    expect(screen.getByLabelText(/Lambda/)).toHaveValue("0.038");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Dense wood fiber board");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(api.updateMaterial).toHaveBeenCalledWith("mat_1", {
        name: "Dense wood fiber board",
        category: "insulation",
        density_kg_m3: null,
        specific_heat_j_kgk: null,
        conductivity_w_mk: 0.038,
        emissivity: null,
        color: null,
        source: null,
        url: null,
        comments: null,
      });
    });
  });
});
