import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { AuthSession } from "../../../auth/types";
import * as api from "../../api";
import { CATALOG_EDIT } from "../../lib";
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
      overflowMenuActions,
      readOnly,
    }: {
      rows: MockMaterialRow[];
      onRowOpen?: (row: MockMaterialRow) => void;
      overflowMenuActions?: ReactNode;
      readOnly?: boolean;
    }) => (
      <div data-testid="materials-grid" data-read-only={readOnly ? "true" : "false"}>
        {overflowMenuActions ? (
          <div data-testid="overflow-actions">{overflowMenuActions}</div>
        ) : null}
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
  capabilities: [],
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

function renderPage(session: AuthSession = SESSION) {
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
          <MaterialsCatalogPage session={session} />
        </MemoryRouter>
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
}

// The page mounts useLocalTableViewState which reads/writes localStorage
// under `phn:tableView:v1:user_1:catalog_materials`. Clear between tests
// so a write from one test never leaks into the next test's initial view.
beforeEach(() => {
  window.localStorage.clear();
});

describe("MaterialsCatalogPage", () => {
  test("renders non-catalog editors in read-only mode without import", async () => {
    vi.spyOn(api, "listMaterials").mockResolvedValue({ items: [WOOD_FIBER] });

    renderPage();

    expect(await screen.findByText("1 material")).toBeInTheDocument();
    expect(screen.getByTestId("materials-grid")).toHaveAttribute("data-read-only", "true");
    expect(screen.queryByRole("button", { name: "New Material +" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import JSON…" })).not.toBeInTheDocument();
  });

  test("renders catalog editors with import and write affordances", async () => {
    vi.spyOn(api, "listMaterials").mockResolvedValue({ items: [WOOD_FIBER] });

    renderPage({ ...SESSION, capabilities: [CATALOG_EDIT] });

    expect(await screen.findByText("1 material")).toBeInTheDocument();
    expect(screen.getByTestId("materials-grid")).toHaveAttribute("data-read-only", "false");
    expect(screen.getByRole("button", { name: "New Material +" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import JSON…" })).toBeInTheDocument();
  });

  test("opens the new material modal from the top-left action", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "listMaterials").mockResolvedValue({ items: [] });
    vi.spyOn(api, "createMaterial").mockResolvedValue(WOOD_FIBER);

    renderPage({ ...SESSION, capabilities: [CATALOG_EDIT] });

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

    renderPage({ ...SESSION, capabilities: [CATALOG_EDIT] });

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
