import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { AuthSession } from "../../../auth/types";
import * as api from "../../api";
import { MaterialsCatalogPage } from "../MaterialsCatalogPage";

vi.mock("../../../../shared/ui/data-table", async () => {
  const actual = await vi.importActual<typeof import("../../../../shared/ui/data-table")>(
    "../../../../shared/ui/data-table",
  );
  return {
    ...actual,
    DataTable: () => <div data-testid="materials-grid" />,
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
    vi.spyOn(api, "createMaterial").mockResolvedValue({
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
      created_by: null,
      updated_at: "2026-06-04T12:00:00Z",
      updated_by: null,
    });

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
});
