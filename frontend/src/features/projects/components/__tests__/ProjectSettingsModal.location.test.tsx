import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { UnitSystem } from "../../../../lib/units";
import type { ProjectDetail, ProjectLocation } from "../../types";
import { ProjectSettingsModal } from "../ProjectSettingsModal";

const fetchMock = vi.fn();

const PROJECT: ProjectDetail = {
  id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
  name: "West Stockbridge House",
  bt_number: "2426",
  client: "May",
  cert_programs: ["phi"],
  phius_number: null,
  phius_dropbox_url: null,
  owner_display_name: "Ed May",
  active_version_id: "61561caa-44d0-401d-9daa-0fa113df8340",
  last_saved_at: "2026-05-12T18:00:00Z",
  created_at: "2026-05-12T18:00:00Z",
  updated_at: "2026-05-12T18:00:00Z",
  access_mode: "editor",
  active_version: {
    id: "61561caa-44d0-401d-9daa-0fa113df8340",
    project_id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 1,
    body_size_bytes: 230,
    created_at: "2026-05-12T18:00:00Z",
    updated_at: "2026-05-12T18:00:00Z",
  },
  versions: [],
};

const UNSET_LOCATION: ProjectLocation = {
  is_set: false,
  latitude: null,
  longitude: null,
  elevation_m: null,
  time_zone: null,
  true_north_deg: null,
  site_address: null,
  city: null,
  state: null,
  epw_asset_id: null,
  epw_source_url: null,
  updated_at: null,
  epw: null,
};

const SET_LOCATION: ProjectLocation = {
  ...UNSET_LOCATION,
  is_set: true,
  latitude: 42.2876,
  longitude: -73.3662,
  elevation_m: 304.8,
  time_zone: "America/New_York",
  true_north_deg: 8,
  site_address: "1 Main St",
  city: "West Stockbridge",
  state: "MA",
  updated_at: "2026-06-12T18:00:00Z",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  });
}

function deferredResponse(body: unknown) {
  let resolve!: () => void;
  const ready = new Promise<void>((next) => {
    resolve = next;
  });
  return {
    resolve,
    response: ready.then(() => jsonResponse(body)),
  };
}

function renderModal({
  project = PROJECT,
  unitSystem = "SI",
}: {
  project?: ProjectDetail;
  unitSystem?: UnitSystem;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider
        value={{
          unitSystem,
          source: "default",
          error: null,
          setUnitSystem: vi.fn(),
          toggleUnitSystem: vi.fn(),
        }}
      >
        <ProjectSettingsModal project={project} onClose={vi.fn()} />
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ProjectSettingsModal location section", () => {
  test("does not overwrite local edits when the location query resolves late", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const delayedLocation = deferredResponse(UNSET_LOCATION);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location` && init?.method === "PUT") {
        return jsonResponse({
          location: {
            ...UNSET_LOCATION,
            ...JSON.parse(String(init.body)),
            is_set: true,
            updated_at: "2026-06-12T18:30:00Z",
          },
          warnings: [],
        });
      }
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return delayedLocation.response;
      if (url === `/api/v1/projects/${PROJECT.id}/mcp-tokens`) {
        return jsonResponse({ tokens: [] });
      }
      return jsonResponse({}, 404);
    });

    renderModal();

    await screen.findByText("No active MCP tokens.");
    await user.type(screen.getByLabelText("Latitude"), "42.2876");
    delayedLocation.resolve();
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue("42.2876"));
    await user.click(
      within(screen.getByRole("dialog", { name: "Project settings" })).getByRole("button", {
        name: "Save",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          const request = init as RequestInit | undefined;
          return (
            url === `/api/v1/projects/${PROJECT.id}/location` &&
            request?.method === "PUT" &&
            JSON.parse(String(request.body)).latitude === 42.2876
          );
        }),
      ).toBe(true);
    });
  });

  test("saves a partial SI location payload from IP display units", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location` && init?.method === "PUT") {
        return jsonResponse({
          location: {
            ...UNSET_LOCATION,
            ...JSON.parse(String(init.body)),
            is_set: true,
            updated_at: "2026-06-12T18:30:00Z",
          },
          warnings: ["Weather file location differs from project location."],
        });
      }
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(UNSET_LOCATION);
      if (url === `/api/v1/projects/${PROJECT.id}/mcp-tokens`) {
        return jsonResponse({ tokens: [] });
      }
      return jsonResponse({}, 404);
    });

    renderModal({ unitSystem: "IP" });

    await screen.findByText("No active MCP tokens.");
    await user.type(screen.getByLabelText("Latitude"), "42.2876");
    await user.type(screen.getByLabelText("Longitude"), "-73.3662");
    await user.type(screen.getByLabelText("Elevation (ft)"), "1000");
    await user.type(screen.getByLabelText("Time zone"), "America/New_York");
    await user.type(screen.getByLabelText("True north (deg)"), "8");
    await user.type(screen.getByLabelText("Site address"), "1 Main St");
    await user.type(screen.getByLabelText("City"), "West Stockbridge");
    await user.type(screen.getByLabelText("State"), "MA");
    await user.click(
      within(screen.getByRole("dialog", { name: "Project settings" })).getByRole("button", {
        name: "Save",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          if (url !== `/api/v1/projects/${PROJECT.id}/location`) return false;
          const request = init as RequestInit | undefined;
          if (request?.method !== "PUT") return false;
          return (
            JSON.stringify(JSON.parse(String(request.body))) ===
            JSON.stringify({
              latitude: 42.2876,
              longitude: -73.3662,
              elevation_m: 304.8,
              time_zone: "America/New_York",
              true_north_deg: 8,
              site_address: "1 Main St",
              city: "West Stockbridge",
              state: "MA",
            })
          );
        }),
      ).toBe(true);
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  test("blocks hard-invalid location values before save", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(UNSET_LOCATION);
      if (url === `/api/v1/projects/${PROJECT.id}/mcp-tokens`) {
        return jsonResponse({ tokens: [] });
      }
      return jsonResponse({}, 404);
    });

    renderModal();

    await screen.findByText("No active MCP tokens.");
    await user.type(screen.getByLabelText("Latitude"), "91");

    expect(screen.getByText("Latitude must be between -90 and 90 degrees.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("renders viewer location read-only with no write affordances", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(SET_LOCATION);
      return jsonResponse({}, 404);
    });

    renderModal({ project: { ...PROJECT, access_mode: "viewer" }, unitSystem: "IP" });

    expect(await screen.findByText("42.2876 deg / -73.3662 deg")).toBeVisible();
    expect(screen.getByText("1000.0 ft")).toBeVisible();
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
