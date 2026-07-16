// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import type { ProjectDetail } from "../../projects/types";
import { resetEnvelopeCanvasZoomForTests } from "../hooks/useEnvelopeCanvasZoom";
import { EnvelopePage } from "../routes/EnvelopePage";
import type { EnvelopeReadResponse } from "../types";
import {
  PHASE16_BULK_ASSEMBLY_COUNT,
  PHASE16_BULK_LAYER_COUNT,
  PHASE16_BULK_SEGMENT_COUNT,
  PHASE16_EDGE_ASSEMBLY_ID,
  PHASE16_EDGE_ASSEMBLY_NAME,
  phase16DriftFixture,
  phase16EnvelopeFixture,
} from "./phase16-fixtures";

const PROJECT_ID = "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5";
const VERSION_ID = "61561caa-44d0-401d-9daa-0fa113df8340";
const fetchMock = vi.fn();

const project: ProjectDetail = {
  id: PROJECT_ID,
  name: "West Stockbridge House",
  public_alias: null,
  display_name: "West Stockbridge House",
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
      color: "#dce6c8",
      specification_status: "missing",
      datasheet_asset_ids: [],
      source: null,
      url: null,
      comments: "Candidate product.",
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
      color: null,
      specification_status: "complete",
      datasheet_asset_ids: [],
      source: null,
      url: null,
      comments: null,
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
      color: null,
      specification_status: "na",
      datasheet_asset_ids: [],
      source: null,
      url: null,
      comments: null,
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
  resetEnvelopeCanvasZoomForTests();
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

  test("assembly sidebar renders type icons without changing link names", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            assemblies: [
              { ...envelopePayload.assemblies[0], id: "asm_wall", name: "Wall", type: "wall" },
              { ...envelopePayload.assemblies[0], id: "asm_roof", name: "Roof", type: "roof" },
              { ...envelopePayload.assemblies[0], id: "asm_floor", name: "Floor", type: "floor" },
              { ...envelopePayload.assemblies[0], id: "asm_other", name: "Other", type: "other" },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall`);

    expect(await screen.findByRole("link", { name: "Wall" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Roof" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Floor" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Other" })).toBeInTheDocument();
    for (const type of ["wall", "roof", "floor", "other"]) {
      expect(
        document.querySelector(
          `.element-sidebar__row-link[data-assembly-type="${type}"] .element-sidebar__row-icon`,
        ),
      ).toBeInTheDocument();
    }
  });

  test("assembly sidebar shows the full assembly name on row hover", async () => {
    const longName = "R-AT Attic Framing Over Existing Board Sheathing";
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            assemblies: [{ ...envelopePayload.assemblies[0], name: longName }],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    const assemblyLink = await screen.findByRole("link", { name: longName });
    await userEvent.hover(assemblyLink);

    // Name tooltip opens on a medium hover delay via the shared <Tooltip>.
    const tooltip = await screen.findByText(
      longName,
      { selector: ".app-tooltip" },
      { timeout: 2000 },
    );
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(assemblyLink).toHaveAttribute("aria-describedby", tooltip.id);
  });

  test("assembly sidebar command tooltips render outside the clipped list", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    const renameButton = screen.getByRole("button", { name: "Rename assembly" });
    expect(renameButton).not.toHaveAttribute("data-sidebar-tooltip");

    await userEvent.hover(renameButton);

    // Row-action tooltips open on a long hover delay via the shared <Tooltip>.
    const tooltip = await screen.findByText(
      "Rename assembly",
      { selector: ".app-tooltip" },
      { timeout: 2000 },
    );
    const sidebarList = document.querySelector(".element-sidebar__list");
    expect(tooltip).toHaveTextContent("Rename assembly");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(sidebarList?.contains(tooltip)).toBe(false);
    expect(tooltip.closest("[data-radix-popper-content-wrapper]")?.parentElement).toBe(
      document.body,
    );
    expect(renameButton).toHaveAttribute("aria-describedby", tooltip.id);
  });

  test("unit toggle changes labels without changing canvas dimensions", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    const stage = await screen.findByTestId("assembly-canvas-stage");
    const initialWidth = stage.getAttribute("style");
    expect(stage).toHaveStyle({ width: "881.8px" });
    expect(screen.getByTestId("total-thickness")).toHaveTextContent("88 mm");

    await userEvent.click(screen.getByRole("button", { name: "IP" }));

    expect(screen.getByTestId("total-thickness")).toHaveTextContent("3.46 in");
    expect(await screen.findByTestId("assembly-thermal-label")).toHaveTextContent(
      "7.5 h-ft2-F/Btu",
    );
    expect(screen.getByTestId("assembly-canvas-stage").getAttribute("style")).toBe(initialWidth);
  });

  test("material editor unit toggle updates modal values and posts canonical SI", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`);

    expect(await screen.findByText("Wood fiber board")).toBeInTheDocument();
    const editMaterialButton = screen.getAllByRole("button", {
      name: "Edit material attributes",
    })[0];
    if (!editMaterialButton) throw new Error("Expected material edit button.");
    await userEvent.click(editMaterialButton);

    const dialog = await screen.findByRole("dialog", { name: /Edit material/ });
    expect(within(dialog).getByLabelText(/Lambda/)).toHaveValue("0.038");
    expect(within(dialog).getByLabelText(/Density/)).toHaveValue("160");
    expect(within(dialog).getByLabelText(/Specific heat/)).toHaveValue("2100");

    await userEvent.click(within(dialog).getByRole("radio", { name: "Set display units to IP" }));

    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Lambda/)).toHaveValue("0.022");
    });
    expect(within(dialog).getByLabelText(/Density/)).toHaveValue("10");
    expect(within(dialog).getByLabelText(/Specific heat/)).toHaveValue("0.502");
    expect(within(dialog).getByRole("radio", { name: "Set display units to IP" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(within(dialog).getByRole("radio", { name: "Set display units to SI" }));

    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Lambda/)).toHaveValue("0.038");
    });
    expect(within(dialog).getByLabelText(/Density/)).toHaveValue("160");
    expect(within(dialog).getByLabelText(/Specific heat/)).toHaveValue("2100");

    await userEvent.click(within(dialog).getByRole("radio", { name: "Set display units to IP" }));

    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Lambda/)).toHaveValue("0.022");
    });

    await userEvent.clear(within(dialog).getByLabelText("Name"));
    await userEvent.type(within(dialog).getByLabelText("Name"), "Wood fiber board updated");
    await userEvent.click(within(dialog).getByRole("button", { name: "Update material" }));

    await waitFor(() => {
      expect(commandRequestBodies()).toContainEqual({
        command: {
          kind: "update_project_material",
          project_material_id: "pmat_insul",
          name: "Wood fiber board updated",
          category: "Insulation",
          conductivity_w_mk: 0.038,
          density_kg_m3: 160,
          specific_heat_j_kgk: 2100,
          emissivity: 0.9,
          comments: "Candidate product.",
        },
      });
    });
  });

  test("collapsed assembly sidebar preserves active assembly and zoom", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const zoomedWidth = screen.getByTestId("assembly-canvas-stage").getAttribute("style");

    await userEvent.click(screen.getByRole("button", { name: "Collapse assembly sidebar" }));

    expect(screen.queryByRole("link", { name: /WALL-C3/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`,
    );
    expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");
    expect(screen.getByTestId("assembly-canvas-stage").getAttribute("style")).toBe(zoomedWidth);

    await userEvent.click(screen.getByRole("button", { name: "Expand assembly sidebar" }));

    expect(await screen.findByRole("link", { name: /WALL-C3/ })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");
  });

  test("switching active assemblies preserves the user zoom level", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    clientWidthSpy.mockReturnValue(1000);
    const secondAssembly = {
      ...envelopePayload.assemblies[0]!,
      id: "asm_roof_r1",
      name: "ROOF-R1",
      type: "roof" as const,
      layers: [
        {
          ...envelopePayload.assemblies[0]!.layers[0]!,
          id: "lyr_roof",
          thickness_mm: 80,
          segments: [
            {
              ...envelopePayload.assemblies[0]!.layers[0]!.segments[0]!,
              id: "seg_roof",
              width_mm: 300,
            },
          ],
        },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            assemblies: [envelopePayload.assemblies[0]!, secondAssembly],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    try {
      renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

      await screen.findByRole("link", { name: /ROOF-R1/ });
      await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
      expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");

      await userEvent.click(screen.getByRole("link", { name: /ROOF-R1/ }));

      await waitFor(() => {
        expect(screen.getByTestId("location")).toHaveTextContent(
          `/projects/${PROJECT_ID}/envelope/assemblies/asm_roof_r1`,
        );
      });
      expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");
    } finally {
      clientWidthSpy.mockRestore();
    }
  });

  test("returning to envelope from another project page preserves the user zoom level", async () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get");
    clientWidthSpy.mockReturnValue(1000);

    try {
      renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

      await screen.findByRole("link", { name: /WALL-C3/ });
      await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
      expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");

      await userEvent.click(screen.getByRole("button", { name: "Go climate" }));
      expect(screen.getByTestId("location")).toHaveTextContent(`/projects/${PROJECT_ID}/climate`);

      await userEvent.click(screen.getByRole("button", { name: "Go envelope" }));
      await screen.findByRole("link", { name: /WALL-C3/ });
      expect(screen.getByTestId("canvas-zoom")).toHaveTextContent("150%");
    } finally {
      clientWidthSpy.mockRestore();
    }
  });

  test("flip segments posts semantic assembly command", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    const flipSegments = screen.getByRole("button", { name: "Flip segments" });
    expect(flipSegments).not.toHaveAttribute("aria-pressed");

    await userEvent.click(flipSegments);

    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "flip_segments", assembly_id: "asm_wall_c3" },
    });
  });

  test("flip outside posts semantic flip_orientation command", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Flip outside" }));

    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "flip_orientation", assembly_id: "asm_wall_c3" },
    });
  });

  test("flip layers posts semantic flip_layers command", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Flip layers" }));

    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "flip_layers", assembly_id: "asm_wall_c3" },
    });
  });

  test("pending flip segments command disables duplicate submission", async () => {
    let resolveCommand: (response: Response) => void = () => {};
    const commandResponse = new Promise<Response>((resolve) => {
      resolveCommand = resolve;
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) return commandResponse;
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    const flipSegments = screen.getByRole("button", { name: "Flip segments" });
    await userEvent.click(flipSegments);
    await userEvent.click(flipSegments);

    expect(flipSegments).toBeDisabled();
    expect(commandRequestBodies()).toHaveLength(1);

    resolveCommand(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
    await waitFor(() => expect(flipSegments).not.toBeDisabled());
  });

  test("flip operations are disabled during pick mode", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Pick segment assignment" }));

    expect(screen.getByRole("button", { name: "Flip outside" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Flip layers" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Flip segments" })).toBeDisabled();
  });

  test("assembly canvas renders segments in one to-scale svg without layer or segment clamps", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            assemblies: [
              {
                ...envelopePayload.assemblies[0]!,
                layers: [
                  {
                    id: "lyr_half_inch",
                    order: 0,
                    thickness_mm: 12.7,
                    segments: [
                      {
                        id: "seg_half_inch",
                        order: 0,
                        width_mm: 50.8,
                        is_continuous_insulation: false,
                        steel_stud_spacing_mm: null,
                        project_material_id: null,
                        photo_asset_ids: [],
                        use_site_notes: null,
                      },
                    ],
                  },
                  {
                    id: "lyr_three_half_inch",
                    order: 1,
                    thickness_mm: 88.9,
                    segments: [
                      {
                        id: "seg_three_half_inch",
                        order: 0,
                        width_mm: 355.6,
                        is_continuous_insulation: false,
                        steel_stud_spacing_mm: null,
                        project_material_id: null,
                        photo_asset_ids: [],
                        use_site_notes: null,
                      },
                    ],
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

    const svg = await screen.findByTestId("assembly-svg-canvas");
    const stage = screen.getByTestId("assembly-canvas-stage");
    const overlay = document.getElementById("assembly-canvas-overlay");
    const labels = document.getElementById("assembly-orientation-labels");
    expect(svg).toHaveAttribute("viewBox", "-1 -1 357.6 103.6");
    expect(svg).toHaveAttribute("height", "103.6");
    expect(svg).toHaveStyle({ top: "0px" });
    expect(stage).toHaveStyle({ height: "105.6px" });
    expect(overlay).toHaveStyle({ top: "1px", height: "101.6px" });
    expect(labels).toHaveStyle({ top: "1px", height: "101.6px" });
    const segments = screen.getAllByTestId("assembly-svg-segment");

    expect(segments).toHaveLength(2);
    expect(Number(segments[0]!.getAttribute("height"))).toBeCloseTo(12.7);
    expect(Number(segments[1]!.getAttribute("height"))).toBeCloseTo(88.9);
    expect(
      Number(segments[1]!.getAttribute("height")) / Number(segments[0]!.getAttribute("height")),
    ).toBeCloseTo(7);
    expect(
      Number(segments[1]!.getAttribute("width")) / Number(segments[0]!.getAttribute("width")),
    ).toBeCloseTo(7);
  });

  test("segment add controls use canvas hover-hint tooltips with inward endpoint placement", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    const addBefore = screen.getByRole("button", {
      name: "Add segment before Wood fiber board segment in layer 1",
    });
    const addAfter = screen.getByRole("button", {
      name: "Add segment after Wood fiber board segment in layer 1",
    });

    expect(addBefore).toHaveAttribute("data-toolbar-tooltip", "Add segment before");
    expect(addBefore).toHaveAttribute("data-toolbar-tooltip-placement", "start");
    expect(addBefore).not.toHaveAttribute("data-tooltip");
    expect(addAfter).toHaveAttribute("data-toolbar-tooltip", "Add segment after");
    expect(addAfter).toHaveAttribute("data-toolbar-tooltip-placement", "end");
    expect(addAfter).not.toHaveAttribute("data-tooltip");
  });

  test("assembly legend is scoped to active materials and follows the unit preference", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    const legend = await screen.findByRole("complementary", { name: "Material legend" });
    expect(within(legend).getByText("Wood fiber board")).toBeInTheDocument();
    const conductivityHeader = within(legend).getByRole("columnheader", {
      name: "Conductivity [W/(m-K)]",
    });
    expect(within(conductivityHeader).getByText("Conductivity")).toBeInTheDocument();
    expect(within(conductivityHeader).getByText("[W/(m-K)]")).toHaveClass("material-legend-unit");
    expect(within(legend).getByRole("columnheader", { name: "Density [kg/m3]" })).toHaveTextContent(
      "Density[kg/m3]",
    );
    expect(
      within(legend).getByRole("columnheader", { name: "Specific heat [J/(kg-K)]" }),
    ).toHaveTextContent("Specific heat[J/(kg-K)]");
    expect(within(legend).getByText("Emissivity")).toBeInTheDocument();
    expect(within(legend).getByText("0.038")).toBeInTheDocument();
    expect(within(legend).getByText("160")).toBeInTheDocument();
    expect(within(legend).getByText("2,100")).toBeInTheDocument();
    expect(within(legend).getByText("0.9")).toBeInTheDocument();
    expect(within(legend).queryByText("Dense-pack cellulose")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Unused air barrier")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "IP" }));

    expect(
      within(legend).getByRole("columnheader", { name: "Resistivity [R/inch]" }),
    ).toHaveTextContent("Resistivity[R/inch]");
    expect(
      within(legend).getByRole("columnheader", { name: "Density [lb/ft3]" }),
    ).toHaveTextContent("Density[lb/ft3]");
    expect(
      within(legend).getByRole("columnheader", { name: "Specific heat [Btu/(lb-F)]" }),
    ).toHaveTextContent("Specific heat[Btu/(lb-F)]");
    expect(within(legend).getByText("3.795")).toBeInTheDocument();
    expect(within(legend).getByText("10")).toBeInTheDocument();
    expect(within(legend).getByText("0.502")).toBeInTheDocument();
  });

  test("materials tab renders segment use-site notes and hides unused na cards in viewer mode", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`, {
      projectOverride: { access_mode: "viewer" },
    });

    expect(await screen.findByText("Wood fiber board")).toBeInTheDocument();
    expect(screen.queryByText("Unused air barrier")).not.toBeInTheDocument();
    await userEvent.click(
      screen
        .getByText("Wood fiber board")
        .closest("[role='row']")!
        .querySelector("button[aria-label='Expand row']") as HTMLElement,
    );
    expect(await screen.findByText("Use over exterior sheathing.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=version"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("materials tab renders datasheet and site-photo evidence in read-only mode", async () => {
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

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`, {
      projectOverride: { access_mode: "viewer" },
    });

    await userEvent.click(
      (await screen.findByText("Wood fiber board"))
        .closest("[role='row']")!
        .querySelector("button[aria-label='Expand row']") as HTMLElement,
    );
    expect(await screen.findByTitle("wood-fiber.pdf · application/pdf")).toBeInTheDocument();
    expect(screen.getByTitle("install.png · image/png")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Drop files here/ })).not.toBeInTheDocument();
  });

  test("na material status hides datasheet upload controls", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`);

    const unusedRow = (await screen.findByText("Unused air barrier")).closest("[role='row']");
    expect(unusedRow).not.toBeNull();
    await userEvent.click(
      unusedRow!.querySelector("button[aria-label='Expand row']") as HTMLElement,
    );
    expect(screen.queryByRole("button", { name: /Drop files here/ })).not.toBeInTheDocument();
  });

  test("materials tab groups N/A and unused materials in lower sections", async () => {
    const project_materials = envelopePayload.project_materials.map((material) =>
      material.id === "pmat_cellulose"
        ? ({ ...material, specification_status: "na" } as const)
        : material,
    );
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, project_materials }));
      }
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            draft_etag: "draft-etag-after-unused-remove",
            project_materials: project_materials.filter(
              (material) => material.id !== "pmat_unused",
            ),
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`);

    expect(await screen.findByText("Wood fiber board")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "In scope" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "N/A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unused" })).toBeInTheDocument();

    const materialNames = Array.from(document.querySelectorAll(".report-table__cell--primary")).map(
      (cell) => cell.textContent,
    );
    expect(materialNames).toEqual([
      "Wood fiber board",
      "Dense-pack cellulose",
      "Unused air barrier",
    ]);

    const activeSection = screen.getByRole("heading", { name: "In scope" }).closest("section");
    const backgroundSection = screen.getByRole("heading", { name: "N/A" }).closest("section");
    const unusedSection = screen.getByRole("heading", { name: "Unused" }).closest("section");
    expect(activeSection).not.toBeNull();
    expect(backgroundSection).not.toBeNull();
    expect(unusedSection).not.toBeNull();
    expect(within(activeSection as HTMLElement).getByText("Wood fiber board")).toBeInTheDocument();
    expect(
      within(backgroundSection as HTMLElement).getByText("Dense-pack cellulose"),
    ).toBeInTheDocument();
    expect(
      within(unusedSection as HTMLElement).getByText("Unused air barrier"),
    ).toBeInTheDocument();
    expect(backgroundSection).toHaveClass("materials-panel__section--background");
    expect(unusedSection).toHaveClass("materials-panel__section--unused");

    await userEvent.click(
      within(unusedSection as HTMLElement).getByRole("button", {
        name: "Remove unused material Unused air barrier",
      }),
    );
    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "remove_project_material", project_material_id: "pmat_unused" },
    });
  });

  test("materials status selector opens options outside the clipped report table", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/materials`);

    const woodFiberRow = (await screen.findByText("Wood fiber board")).closest(
      "[role='row']",
    ) as HTMLElement | null;
    if (!woodFiberRow) throw new Error("Expected Wood fiber board row.");

    const statusToggle = within(woodFiberRow).getByRole("button", { name: "Status options" });
    const chevron = statusToggle.querySelector(".lucide-chevron-down");
    expect(chevron).not.toBeNull();

    await userEvent.click(statusToggle);

    const listbox = await screen.findByRole("listbox");
    expect(listbox.closest(".report-table")).toBeNull();
    expect(within(listbox).getByRole("option", { name: "Question" })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: "Complete" })).toBeInTheDocument();
  });

  test("catalog drift badges render in assemblies and materials tabs", async () => {
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
    await userEvent.click(screen.getByRole("link", { name: "Review all" }));

    // Drift now surfaces inside the per-material expanded row, not as a
    // top-of-page "Catalog review" band. Expand the drifted material and
    // confirm the MaterialDriftBadge renders inside.
    await userEvent.click(
      (await screen.findByText("Wood fiber board"))
        .closest("[role='row']")!
        .querySelector("button[aria-label='Expand row']") as HTMLElement,
    );
    expect(await screen.findAllByText("Catalog drift")).not.toHaveLength(0);
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

  test("new assembly modal posts the selected type and name", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            draft_etag: "draft-etag-2",
            assemblies: [
              {
                ...envelopePayload.assemblies[0],
                id: "asm_floor_cs",
                name: "F-CS",
                type: "floor",
              },
            ],
          }),
        );
      }
      if (url.includes("/envelope?")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, assemblies: [] }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies`);

    await screen.findByText("No assemblies yet");
    await userEvent.click(screen.getByRole("button", { name: "New assembly" }));

    const dialog = await screen.findByRole("dialog", { name: "New assembly" });
    const nameInput = within(dialog).getByLabelText("Name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "F-CS");
    await userEvent.click(within(dialog).getByRole("radio", { name: /Floor/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create assembly" }));

    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "create_assembly", name: "F-CS", type: "floor" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/projects/${PROJECT_ID}/envelope/assemblies/asm_floor_cs`,
      ),
    );
  });

  test("duplicate assembly modal navigates to the copied assembly", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(
          jsonResponse({
            ...envelopePayload,
            draft_etag: "draft-etag-2",
            assemblies: [
              envelopePayload.assemblies[0],
              {
                ...envelopePayload.assemblies[0],
                id: "asm_wall_c3_copy",
                name: "WALL-C3 Copy",
              },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Duplicate assembly" }));
    const dialog = await screen.findByRole("dialog", { name: "Duplicate assembly" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(commandRequestBodies()).toContainEqual({
      command: { kind: "duplicate_assembly", assembly_id: "asm_wall_c3", name: "WALL-C3 Copy" },
    });
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        `/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3_copy`,
      ),
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
    await userEvent.click(screen.getByRole("button", { name: "Rename assembly" }));
    const nameInput = screen.getByLabelText("Assembly name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "WALL-C4");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

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

  test("header inline rename updates the assembly heading and sidebar label", async () => {
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

    expect(await screen.findByRole("heading", { name: "WALL-C3" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Edit assembly name" }));
    const nameInput = screen.getByLabelText("Assembly name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "WALL-C4");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByRole("heading", { name: "WALL-C4" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WALL-C4/ })).toBeInTheDocument();
    expect(commandRequestBodies().at(-1)).toEqual({
      command: { kind: "rename_assembly", assembly_id: "asm_wall_c3", name: "WALL-C4" },
    });
  });

  test("dimension label edits layer thickness with explicit unit parsing", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Edit layer 1 thickness" }));
    const thicknessInput = screen.getByRole("textbox", { name: "Layer 1 thickness" });
    await userEvent.clear(thicknessInput);
    await userEvent.type(thicknessInput, "2 in{Enter}");
    const commandCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/draft/envelope/commands"),
    )!;
    const commandOptions = commandCall[1]!;
    expect(JSON.parse(commandOptions?.body as string)).toEqual({
      command: {
        kind: "update_layer_thickness",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
        thickness_mm: 50.8,
      },
    });
  });

  test("open inline thickness editor keeps unitless draft in the starting unit system", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Edit layer 1 thickness" }));
    const thicknessInput = screen.getByRole("textbox", { name: "Layer 1 thickness" });
    await userEvent.clear(thicknessInput);
    await userEvent.type(thicknessInput, "51");
    await userEvent.click(screen.getByRole("button", { name: "IP" }));

    expect(commandRequestBodies()).toContainEqual({
      command: {
        kind: "update_layer_thickness",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
        thickness_mm: 51,
      },
    });
  });

  test("canvas delete controls open existing layer and segment confirmation commands", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Edit layer 1 thickness" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete layer 1" }));
    expect(await screen.findByRole("dialog", { name: "Delete layer" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Wood fiber board segment in layer 1" }),
    );
    expect(await screen.findByRole("dialog", { name: "Segment properties" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete segment" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More segment actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete segment" }));
    expect(await screen.findByRole("dialog", { name: "Delete segment" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(commandRequestBodies()).toContainEqual({
      command: {
        kind: "delete_layer",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
      },
    });
    expect(commandRequestBodies()).toContainEqual({
      command: {
        kind: "delete_segment",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
        segment_id: "seg_insul",
      },
    });
  });

  test("add layer dialog focuses and selects the thickness draft", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Add layer below layer 1" }));

    expect(await screen.findByRole("dialog", { name: "Add layer" })).toBeInTheDocument();
    const thicknessInput = screen.getByRole("textbox", {
      name: /Thickness/,
    }) as HTMLInputElement;
    await waitFor(() => expect(thicknessInput).toHaveFocus());
    expect(thicknessInput.selectionStart).toBe(0);
    expect(thicknessInput.selectionEnd).toBe(thicknessInput.value.length);
  });

  test("canvas eyedropper enters paint mode and posts paste assignment command", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    expect(screen.getByRole("button", { name: "Paint picked assignment" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Pick segment assignment" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Pick assignment from Wood fiber board segment in layer 1",
      }),
    );
    expect(screen.getByRole("button", { name: "Paint picked assignment" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("assembly-canvas")).toHaveAttribute("data-paint-mode", "pasting");
    await userEvent.click(
      screen.getByRole("button", { name: "Paint assignment to No material segment in layer 2" }),
    );

    expect(commandRequestBodies()).toContainEqual({
      command: {
        kind: "paste_assignment",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_service",
        segment_id: "seg_null",
        project_material_id: "pmat_insul",
        is_continuous_insulation: false,
        steel_stud_spacing_mm: null,
      },
    });
  });

  test("canvas paint ignores rapid duplicate clicks while the command is in flight", async () => {
    const commandResolvers: Array<(response: Response) => void> = [];
    const commandResponse = new Promise<Response>((resolve) => {
      commandResolvers.push(resolve);
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) return commandResponse;
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Pick segment assignment" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Pick assignment from Wood fiber board segment in layer 1",
      }),
    );
    const paintTarget = screen.getByRole("button", {
      name: "Paint assignment to No material segment in layer 2",
    });
    await userEvent.click(paintTarget);
    await userEvent.click(paintTarget);

    expect(commandRequestBodies()).toHaveLength(1);

    commandResolvers[0]?.(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
  });

  test("undo last canvas paint restores the previous assignment", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Pick segment assignment" }));
    await userEvent.click(
      screen.getByRole("button", {
        name: "Pick assignment from Wood fiber board segment in layer 1",
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Paint assignment to No material segment in layer 2" }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Undo last paint" }));

    const commands = commandRequestBodies();
    expect(commands).toContainEqual({
      command: {
        kind: "paste_assignment",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_service",
        segment_id: "seg_null",
        project_material_id: null,
        is_continuous_insulation: false,
        steel_stud_spacing_mm: 406.4,
      },
    });
  });

  test("segment material picker gates catalog loading until From catalog opens", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    expect(catalogMaterialFetchCalls()).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Edit Wood fiber board segment in layer 1" }),
    );

    expect(await screen.findByRole("dialog", { name: "Segment properties" })).toBeInTheDocument();
    expect(catalogMaterialFetchCalls()).toHaveLength(0);

    await userEvent.click(screen.getByRole("tab", { name: "From catalog" }));

    expect(await screen.findByRole("combobox", { name: "Catalog material" })).toBeInTheDocument();
    expect(screen.queryByText("Catalog material")).not.toBeInTheDocument();
    expect(catalogMaterialFetchCalls()).toHaveLength(1);
    await userEvent.click(screen.getByRole("combobox", { name: "Catalog material" }));
    expect(
      await screen.findByRole("option", { name: "Cork board Insulation" }),
    ).toBeInTheDocument();
  });

  test("segment material picker posts project material commands from the simplified modal", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Edit Wood fiber board segment in layer 1" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Segment properties" });
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("tab", { name: "Hand-enter" })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Detach to custom material" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Project material")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Shared material values")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Material attributes" })).toBeInTheDocument();
    expect(within(dialog).getByText("Conductivity")).toBeInTheDocument();
    expect(within(dialog).getByText("0.038 W/(m-K)")).toBeInTheDocument();
    expect(within(dialog).getByText("160 kg/m3")).toBeInTheDocument();
    expect(within(dialog).getByText("2,100 J/(kg-K)")).toBeInTheDocument();
    expect(within(dialog).getByText("#dce6c8")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Steel stud parameters").closest("details"),
    ).not.toHaveAttribute("open");
    expect(within(dialog).getByRole("button", { name: "Apply" })).toHaveClass("primary-button");

    await userEvent.click(within(dialog).getByRole("combobox", { name: "Project material" }));
    await userEvent.click(
      within(dialog).getByRole("option", { name: "Dense-pack cellulose 1 uses" }),
    );

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Segment properties" })).not.toBeInTheDocument();

    const commands = commandRequestBodies();
    expect(commands).toContainEqual({
      command: {
        kind: "pick_project_material",
        assembly_id: "asm_wall_c3",
        layer_id: "lyr_sheathing",
        segment_id: "seg_insul",
        project_material_id: "pmat_cellulose",
      },
    });
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        command: expect.objectContaining({ kind: "hand_enter_material" }),
      }),
    );
  });

  test("segment modal opens steel stud parameters when the segment uses steel studs", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(
      screen.getByRole("button", { name: "Edit No material segment in layer 2" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Segment properties" });
    expect(
      within(dialog).getByRole("group", { name: "Steel stud parameters" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Stud spacing (mm)" })).toHaveValue("406.4");
    expect(within(dialog).queryByText("Steel stud parameters")?.closest("details")).toBeNull();
    expect(within(dialog).getByRole("region", { name: "Material attributes" })).toBeInTheDocument();
    expect(within(dialog).getAllByText("No material").length).toBeGreaterThan(0);
  });

  test("locked editor version loads saved source and keeps edit action disabled", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`, {
      projectOverride: { active_version: { ...project.active_version!, locked: true } },
    });

    expect(await screen.findByRole("link", { name: /WALL-C3/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename assembly" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add assembly" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=version"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("phase 16 scale fixture keeps edge cases visible and locked mode read-only", async () => {
    const payload = phase16EnvelopeFixture(PROJECT_ID, VERSION_ID, { source: "version" });
    expect(payload.assemblies).toHaveLength(PHASE16_BULK_ASSEMBLY_COUNT + 1);
    expect(payload.assemblies.at(-1)?.layers).toHaveLength(PHASE16_BULK_LAYER_COUNT);
    expect(payload.assemblies.at(-1)?.layers[0]?.segments).toHaveLength(PHASE16_BULK_SEGMENT_COUNT);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope?")) return Promise.resolve(jsonResponse(payload));
      if (url.includes("/envelope/material-catalog-drift?")) {
        return Promise.resolve(jsonResponse(phase16DriftFixture(PROJECT_ID, VERSION_ID)));
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/${PHASE16_EDGE_ASSEMBLY_ID}`, {
      projectOverride: { active_version: { ...project.active_version!, locked: true } },
    });

    expect(
      await screen.findByRole("link", { name: PHASE16_EDGE_ASSEMBLY_NAME }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PHASE16-BULK-12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename assembly" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add assembly" })).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: /Edit Extremely long wood-fiber insulation product name/,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByTitle(
        "Extremely long wood-fiber insulation product name used to test clipped labels - 12.7 mm",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTitle("No material - 38.1 mm")).toBeInTheDocument();
    expect(screen.getByText("Missing material")).toBeInTheDocument();

    const legend = screen.getByRole("complementary", { name: "Material legend" });
    expect(within(legend).getByText(/Extremely long wood-fiber/)).toBeInTheDocument();
    expect(within(legend).getByText("Cavity insulation missing lambda")).toBeInTheDocument();
    expect(within(legend).queryByText("Bulk fixture material 1")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Unused QA-only membrane")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope?source=version"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(catalogMaterialFetchCalls()).toHaveLength(0);
  });

  test("download warns when draft is dirty and calls saved-version export", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Assembly actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Download constructions HBJSON" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("last committed version"));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope/export/hbjson"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("PHPP export downloads directly when every assembly is exportable, passing the active units", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);

    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Assembly actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Download in PHPP format" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/envelope/export/phpp?units=SI"),
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  test("PHPP export warns about blocked assemblies, then downloads on confirm", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope/export/phpp/preflight")) {
        return Promise.resolve(
          jsonResponse({
            assemblies: [
              { id: "asm_wall_c3", name: "WALL-C3", exportable: true, reason: null },
              { id: "asm_big", name: "Thick Wall", exportable: false, reason: "too_many_layers" },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);
    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Assembly actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Download in PHPP format" }));

    // The modal lists the blocked assembly and its reason; nothing downloaded yet.
    expect(await screen.findByText("Thick Wall")).toBeInTheDocument();
    expect(screen.getByText(/more than 8 layers/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/envelope/export/phpp?units="),
      expect.anything(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Download anyway" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/envelope/export/phpp?units=SI"),
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  test("PHPP export modal Cancel aborts without downloading", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope/export/phpp/preflight")) {
        return Promise.resolve(
          jsonResponse({
            assemblies: [
              { id: "asm_big", name: "Thick Wall", exportable: false, reason: "too_many_layers" },
            ],
          }),
        );
      }
      return defaultFetchImplementation(url);
    });

    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);
    await screen.findByRole("link", { name: /WALL-C3/ });
    await userEvent.click(screen.getByRole("button", { name: "Assembly actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Download in PHPP format" }));

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Thick Wall")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/envelope/export/phpp?units="),
      expect.anything(),
    );
  });

  test("upload constructions previews the plan then applies an import command", async () => {
    const previewPayload = {
      project_id: PROJECT_ID,
      version_id: VERSION_ID,
      source: "draft",
      version_etag: "version-etag",
      draft_etag: "draft-etag",
      schema_version: 4,
      counts: {
        constructions_add: 1,
        constructions_replace: 0,
        constructions_skip: 0,
        materials_reused: 0,
        materials_picked_from_catalog: 0,
        materials_created: 1,
      },
      constructions: [
        {
          resolution_key: "W_NewWall",
          source_assembly_id: null,
          name: "W_NewWall",
          action: "add_new",
          target_assembly_id: null,
          warnings: [],
        },
      ],
      materials: [
        {
          source_key: "m1",
          name: "Batt",
          decision: "create_new",
          project_material_id: "pmat_new",
          catalog_record_id: null,
          warnings: [],
        },
      ],
      warnings: [],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/envelope/import/hbjson/preview")) {
        return Promise.resolve(jsonResponse(previewPayload));
      }
      if (url.includes("/draft/envelope/commands")) {
        return Promise.resolve(jsonResponse({ ...envelopePayload, draft_etag: "draft-etag-2" }));
      }
      return defaultFetchImplementation(url);
    });

    const { container } = renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`);
    await screen.findByRole("link", { name: /WALL-C3/ });

    await userEvent.click(screen.getByRole("button", { name: "Assembly actions" }));
    expect(
      screen.getByRole("menuitem", { name: "Upload constructions HBJSON" }),
    ).toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ type: "OpaqueConstruction", identifier: "W_NewWall", materials: [] })],
      "constructions.hbjson",
      { type: "application/json" },
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("Import constructions")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/envelope/import/hbjson/preview"),
      expect.objectContaining({ method: "POST" }),
    );

    await userEvent.click(screen.getByRole("button", { name: /Import 1 construction/ }));

    await waitFor(() => {
      const commands = commandRequestBodies() as { command: { kind: string } }[];
      expect(commands.some((body) => body.command.kind === "import_envelope_constructions")).toBe(
        true,
      );
    });
  });

  test("viewer mode hides the whole assembly-actions menu", async () => {
    // HBJSON/PHPP are bulk exports → editor-only (CP-7) and upload is a
    // mutation, so a viewer's assembly-actions menu has nothing to show and the
    // trigger itself is not rendered.
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`, {
      projectOverride: { access_mode: "viewer" },
    });
    await screen.findByRole("link", { name: /WALL-C3/ });

    expect(screen.queryByRole("button", { name: "Assembly actions" })).not.toBeInTheDocument();
  });

  test("viewer clicking a segment opens a read-only detail (CP-5), not the editor", async () => {
    renderEnvelope(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`, {
      projectOverride: { access_mode: "viewer" },
    });
    await screen.findByRole("link", { name: /WALL-C3/ });

    await userEvent.click(
      screen.getByRole("button", { name: "View details for Wood fiber board segment in layer 1" }),
    );

    const detail = await screen.findByRole("dialog", { name: "Segment details" });
    expect(within(detail).getByText("Wood fiber board")).toBeInTheDocument();
    expect(within(detail).getByRole("region", { name: "Material attributes" })).toBeInTheDocument();
    expect(within(detail).getByText("Conductivity")).toBeInTheDocument();
    expect(within(detail).getByText("0.038 W/(m-K)")).toBeInTheDocument();
    expect(within(detail).getByText("160 kg/m3")).toBeInTheDocument();
    expect(within(detail).getByText("2,100 J/(kg-K)")).toBeInTheDocument();
    expect(within(detail).getByText("#dce6c8")).toBeInTheDocument();
    expect(within(detail).getByText("Width")).toBeInTheDocument();
    // It is the read-only inspect, not the editor: no material picker or delete.
    expect(screen.queryByRole("dialog", { name: "Segment properties" })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: /catalog/i })).not.toBeInTheDocument();
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
            <Route path="/projects/:projectId/climate" element={<section>Climate</section>} />
          </Routes>
          <LocationProbe />
          <NavigationProbe />
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

function NavigationProbe() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(`/projects/${PROJECT_ID}/climate`)}>
        Go climate
      </button>
      <button
        type="button"
        onClick={() => navigate(`/projects/${PROJECT_ID}/envelope/assemblies/asm_wall_c3`)}
      >
        Go envelope
      </button>
    </>
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function catalogMaterialFetchCalls() {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes("/api/v1/catalogs/materials"),
  );
}

function commandRequestBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/draft/envelope/commands"))
    .map((call) => JSON.parse(call[1]?.body as string));
}

function defaultFetchImplementation(url: string): Promise<Response> {
  if (url.includes("/sidebar-views")) {
    return Promise.resolve(
      jsonResponse({ view_state_schema_version: 1, view_state: null, updated_at: null }),
    );
  }
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
  if (url.includes("/api/v1/catalogs/materials")) {
    return Promise.resolve(
      jsonResponse({
        items: [
          {
            id: "cat_cork",
            name: "Cork board",
            category: "Insulation",
            conductivity_w_mk: 0.042,
            density_kg_m3: 115,
            specific_heat_j_kgk: 1900,
            emissivity: 0.9,
            current_version_id: "catver_cork",
            catalog_schema_version: 1,
            version_label: "Current",
            version_date: "2026-05-27",
            color: null,
            notes: null,
            source_provenance: null,
            is_active: true,
            created_at: "2026-05-27T20:00:00Z",
            created_by: null,
            updated_at: "2026-05-27T20:00:00Z",
            updated_by: null,
          },
        ],
      }),
    );
  }
  if (url.includes("/envelope/export/hbjson")) {
    return Promise.resolve(jsonResponse({ constructions: {} }));
  }
  if (url.includes("/envelope/export/phpp/preflight")) {
    return Promise.resolve(
      jsonResponse({
        assemblies: [{ id: "asm_wall_c3", name: "WALL-C3", exportable: true, reason: null }],
      }),
    );
  }
  if (url.includes("/envelope/export/phpp")) {
    return Promise.resolve(new Response(new Blob(["zip"]), { status: 200 }));
  }
  throw new Error(`Unhandled fetch in EnvelopePage test: ${url}`);
}
