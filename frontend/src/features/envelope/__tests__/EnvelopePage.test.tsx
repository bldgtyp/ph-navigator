// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import type { ProjectDetail } from "../../projects/types";
import { EnvelopePage } from "../routes/EnvelopePage";
import type { EnvelopeReadResponse } from "../types";

const PROJECT_ID = "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5";
const VERSION_ID = "61561caa-44d0-401d-9daa-0fa113df8340";
const fetchMock = vi.fn();

const project: ProjectDetail = {
  id: PROJECT_ID,
  name: "West Stockbridge House",
  bt_number: "2426",
  client: "May",
  cert_programs: ["phi"],
  phius_number: null,
  phius_dropbox_url: null,
  owner_display_name: "Ed May",
  active_version_id: VERSION_ID,
  last_saved_at: "2026-05-12T18:00:00Z",
  created_at: "2026-05-12T18:00:00Z",
  updated_at: "2026-05-12T18:00:00Z",
  access_mode: "editor",
  active_version: {
    id: VERSION_ID,
    project_id: PROJECT_ID,
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 4,
    body_size_bytes: 230,
    created_at: "2026-05-12T18:00:00Z",
    updated_at: "2026-05-12T18:00:00Z",
  },
  versions: [],
};

const envelopePayload: EnvelopeReadResponse = {
  project_id: PROJECT_ID,
  version_id: VERSION_ID,
  source: "draft",
  version_etag: "version-etag",
  draft_etag: "draft-etag",
  assemblies: [
    {
      id: "asm_wall_c3",
      name: "WALL-C3",
      type: "wall",
      orientation: "last_layer_outside",
      status: { is_complete: false, flags: ["missing_material"] },
      layers: [
        {
          id: "lyr_sheathing",
          order: 0,
          thickness_mm: 50,
          segments: [
            {
              id: "seg_insul",
              order: 0,
              width_mm: 812.8,
              is_continuous_insulation: false,
              steel_stud_spacing_mm: null,
              project_material_id: "pmat_insul",
              photo_asset_ids: [],
              use_site_notes: "Use over exterior sheathing.",
            },
          ],
        },
        {
          id: "lyr_service",
          order: 1,
          thickness_mm: 38,
          segments: [
            {
              id: "seg_null",
              order: 0,
              width_mm: 406.4,
              is_continuous_insulation: false,
              steel_stud_spacing_mm: 406.4,
              project_material_id: null,
              photo_asset_ids: [],
              use_site_notes: null,
            },
          ],
        },
      ],
    },
  ],
  project_materials: [
    {
      id: "pmat_insul",
      name: "Wood fiber board",
      category: "Insulation",
      conductivity_w_mk: 0.038,
      density_kg_m3: 160,
      specific_heat_j_kgk: 2100,
      emissivity: 0.9,
      argb_color: "(255,220,230,200)",
      specification_status: "missing",
      datasheet_asset_ids: [],
      notes: "Candidate product.",
      catalog_origin: null,
      use_sites: [
        {
          assembly_id: "asm_wall_c3",
          assembly_name: "WALL-C3",
          layer_id: "lyr_sheathing",
          layer_order: 0,
          segment_id: "seg_insul",
          segment_order: 0,
          use_site_notes: "Use over exterior sheathing.",
          photo_asset_ids: [],
        },
      ],
    },
    {
      id: "pmat_cellulose",
      name: "Dense-pack cellulose",
      category: "Insulation",
      conductivity_w_mk: 0.039,
      density_kg_m3: 58,
      specific_heat_j_kgk: 2110,
      emissivity: null,
      argb_color: null,
      specification_status: "complete",
      datasheet_asset_ids: [],
      notes: null,
      catalog_origin: null,
      use_sites: [
        {
          assembly_id: "asm_wall_c3",
          assembly_name: "WALL-C3",
          layer_id: "lyr_service",
          layer_order: 1,
          segment_id: "seg_null",
          segment_order: 0,
          use_site_notes: null,
          photo_asset_ids: [],
        },
      ],
    },
    {
      id: "pmat_unused",
      name: "Unused air barrier",
      category: "Membrane",
      conductivity_w_mk: null,
      density_kg_m3: null,
      specific_heat_j_kgk: null,
      emissivity: null,
      argb_color: null,
      specification_status: "na",
      datasheet_asset_ids: [],
      notes: null,
      catalog_origin: null,
      use_sites: [],
    },
  ],
};

const thermalPayload = {
  project_id: PROJECT_ID,
  version_id: VERSION_ID,
  source: "draft",
  assembly_id: "asm_wall_c3",
  input_hash: "a".repeat(64),
  status: { is_complete: false, flags: ["missing_material"] },
  r_parallel_path_m2k_w: 1.316,
  r_isothermal_planes_m2k_w: 1.316,
  r_effective_m2k_w: 1.316,
  u_effective_w_m2k: 0.76,
  warnings: ["One or more segments do not have a material assignment."],
};

const driftPayload = {
  project_id: PROJECT_ID,
  version_id: VERSION_ID,
  source: "draft",
  version_etag: "version-etag",
  draft_etag: "draft-etag",
  materials: [],
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultFetchImplementation);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: vi.fn(() => "blob:hbjson"),
  });
  Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EnvelopePage", () => {
  test("redirects bare envelope route to assemblies and renders the first assembly", async () => {
    renderEnvelope("/projects/5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5/envelope");

    expect(await screen.findByRole("link", { name: /WALL-C3/ })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/projects/5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5/envelope/assemblies/asm_wall_c3",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=draft"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("unit toggle changes labels without changing canvas dimensions", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    const canvas = await screen.findByTestId("assembly-canvas");
    const initialWidth = canvas.getAttribute("style");
    expect(screen.getByTestId("total-thickness")).toHaveTextContent("88 mm");

    await userEvent.click(screen.getByRole("button", { name: "IP" }));

    expect(screen.getByTestId("total-thickness")).toHaveTextContent("3.46 in");
    expect(await screen.findByTestId("assembly-thermal-label")).toHaveTextContent(
      "7.5 h-ft2-F/Btu",
    );
    expect(screen.getByTestId("assembly-canvas").getAttribute("style")).toBe(initialWidth);
  });

  test("specifications render segment use-site notes and hide unused na cards in viewer mode", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/specifications`, {
      projectOverride: { access_mode: "viewer" },
    });

    expect(await screen.findByText("Wood fiber board")).toBeInTheDocument();
    expect(screen.getByText("Use over exterior sheathing.")).toBeInTheDocument();
    expect(screen.queryByText("Unused air barrier")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=version"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("specifications render datasheet and site-photo evidence in read-only mode", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            project_materials: [
              {
                ...envelopePayload.project_materials[0]!,
                datasheet_asset_ids: ["asset_datasheet_1"],
                use_sites: [
                  {
                    ...envelopePayload.project_materials[0]!.use_sites[0]!,
                    photo_asset_ids: ["asset_photo_1"],
                  },
                ],
              },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/specifications`, {
      projectOverride: { access_mode: "viewer" },
    });

    expect(await screen.findByTitle("wood-fiber.pdf · application/pdf")).toBeInTheDocument();
    expect(screen.getByTitle("install.png · image/png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Drop files here/ })).not.toBeInTheDocument();
  });

  test("na material status hides datasheet upload controls", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/specifications`);

    expect(await screen.findByText("Unused air barrier")).toBeInTheDocument();
    const unusedCard = screen.getByText("Unused air barrier").closest("article");
    expect(unusedCard).not.toBeNull();
    expect(unusedCard!).not.toHaveTextContent("Drop files here");
  });

  test("specifications sort incomplete materials before complete materials and unused materials last", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/specifications`);

    expect(await screen.findByText("Wood fiber board")).toBeInTheDocument();

    const materialHeadings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(materialHeadings).toEqual([
      "Wood fiber board",
      "Dense-pack cellulose",
      "Unused air barrier",
    ]);
  });

  test("catalog drift badges render in assemblies and specifications", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            project_materials: [
              {
                ...envelopePayload.project_materials[0]!,
                catalog_origin: {
                  catalog_table: "materials",
                  catalog_record_id: "mat_123",
                  catalog_version_id: "matv_1",
                  catalog_schema_version: 1,
                  synced_at: "2026-05-27T20:00:00Z",
                  local_overrides: [],
                },
              },
              ...envelopePayload.project_materials.slice(1),
            ],
          }),
        );
      }
      if (url.includes("/envelope/material-catalog-drift?")) {
        return Promise.resolve(
          jsonResponse({
            ...driftPayload,
            materials: [
              {
                project_material_id: "pmat_insul",
                state: "drifted",
                catalog_record_id: "mat_123",
                pinned_catalog_version_id: "matv_1",
                current_catalog_version_id: "matv_1",
                local_overrides: [],
                fields: [
                  {
                    key: "conductivity_w_mk",
                    project_value: 0.038,
                    catalog_value: 0.036,
                    is_overridden: false,
                    differs: true,
                  },
                ],
              },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    expect(await screen.findByText("1 material copy needs catalog review.")).toBeInTheDocument();
    expect(screen.getByText("Catalog drift")).toBeInTheDocument();
  });

  test("invalid assembly id redirects to the first sorted assembly", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/does-not-exist`);

    expect(await screen.findByRole("link", { name: /WALL-C3/ })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`,
    );
  });

  test("empty assemblies render the empty state without a redirect loop", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?"))
        return Promise.resolve(jsonResponse({ ...envelopePayload, assemblies: [] }));
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies`);

    expect(await screen.findByText("No assemblies yet")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/projects/${PROJECT_ID}/envelope/assemblies`,
    );
  });

  test("rename command posts semantic payload with draft etag", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            draft_etag: "draft-etag-2",
            assemblies: [{ ...envelopePayload.assemblies[0], name: "WALL-C4" }],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const nameInput = screen.getByLabelText("Name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "WALL-C4");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByRole("link", { name: /WALL-C4/ })).toBeInTheDocument();
    const commandCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/draft/envelope/commands"),
    )!;
    const commandOptions = commandCall[1]!;
    const headers = commandOptions?.headers as Headers;
    expect(commandCall[0]).toContain("/draft/envelope/commands");
    expect(headers.get("If-Match")).toBe("draft-etag");
    expect(JSON.parse(commandOptions?.body as string)).toEqual({
      command: { kind: "rename_assembly", assembly_id: "asm_wall_c3", name: "WALL-C4" },
    });
  });

  test("open length editors keep the draft string stable across unit toggles", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getAllByRole("button", { name: "Thickness" })[0]!);
    const thicknessInput = screen.getByLabelText("Thickness (mm)");
    await userEvent.clear(thicknessInput);
    await userEvent.type(thicknessInput, "50");
    await userEvent.click(screen.getByRole("radio", { name: "Set display units to IP" }));

    expect(screen.getByLabelText("Thickness (mm)")).toHaveValue("50");

    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    const commandCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/draft/envelope/commands"),
    )!;
    const commandOptions = commandCall[1]!;
    expect(JSON.parse(commandOptions?.body as string)).toEqual({
      command: {
        kind: "update_layer_thickness",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
        thickness_mm: 50,
      },
    });
  });

  test("locked editor version loads saved source and keeps edit action disabled", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`, {
      projectOverride: { active_version: { ...project.active_version!, locked: true } },
    });

    expect(await screen.findByText("Locked version")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=version"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("download warns when draft is dirty and calls saved-version export", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Download constructions HBJSON" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("last saved version"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope/export/hbjson"),
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

function renderEnvelope(
  initialEntry: string,
  options: { projectOverride?: Partial<ProjectDetail> } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const testProject = { ...project, ...options.projectOverride };
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitHarness>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/projects/:projectId/envelope/*"
              element={<EnvelopePage project={testProject} />}
            />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </UnitHarness>
    </QueryClientProvider>,
  );
}

function UnitHarness({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("SI");
  return (
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "local",
        error: null,
        setUnitSystem,
        toggleUnitSystem: () => setUnitSystem((current) => (current === "SI" ? "IP" : "SI")),
      }}
    >
      <button type="button" onClick={() => setUnitSystem("IP")}>
        IP
      </button>
      {children}
    </UnitPreferenceContext.Provider>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultFetchImplementation(url: string): Promise<Response> {
  if (url.includes("/envelope?")) return Promise.resolve(jsonResponse(envelopePayload));
  if (url.includes("/thermal?")) return Promise.resolve(jsonResponse(thermalPayload));
  if (url.includes("/envelope/material-catalog-drift?")) {
    return Promise.resolve(jsonResponse(driftPayload));
  }
  if (url.includes("/assets/bulk-urls")) {
    return Promise.resolve(
      jsonResponse({
        items: [
          {
            asset_id: "asset_datasheet_1",
            preview_url: "https://assets.test/wood-fiber.pdf",
            preview_expires_at: "2026-05-26T20:00:00Z",
            download_url: "https://assets.test/wood-fiber-download.pdf",
            download_expires_at: "2026-05-26T21:00:00Z",
            thumbnail_url: null,
            thumbnail_status: "na",
            thumbnail_expires_at: null,
            content_type: "application/pdf",
            original_filename: "wood-fiber.pdf",
            display_name: "wood-fiber.pdf",
            size_bytes: 1234,
          },
          {
            asset_id: "asset_photo_1",
            preview_url: "https://assets.test/install.png",
            preview_expires_at: "2026-05-26T20:00:00Z",
            download_url: "https://assets.test/install-download.png",
            download_expires_at: "2026-05-26T21:00:00Z",
            thumbnail_url: "https://assets.test/install-thumb.png",
            thumbnail_status: "ready",
            thumbnail_expires_at: "2026-05-26T20:00:00Z",
            content_type: "image/png",
            original_filename: "install.png",
            display_name: "install.png",
            size_bytes: 4321,
          },
        ],
      }),
    );
  }
  if (url.includes("/envelope/export/hbjson")) {
    return Promise.resolve(jsonResponse({ constructions: {} }));
  }
  throw new Error(`Unhandled fetch in EnvelopePage test: ${url}`);
}
