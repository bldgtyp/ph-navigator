import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { UnitSystem } from "../../../../lib/units";
import type { ProjectDetail } from "../../types";
import {
  LOCATION_PROJECT as PROJECT,
  SET_LOCATION,
  jsonResponse,
} from "../../testing/locationFixtures";
import { ProjectSettingsModal } from "../ProjectSettingsModal";

const fetchMock = vi.fn();

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
  test("shows location read-only with a pointer to the Climate tab editor", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(SET_LOCATION);
      if (url === `/api/v1/projects/${PROJECT.id}/mcp-tokens`) {
        return jsonResponse({ tokens: [] });
      }
      return jsonResponse({}, 404);
    });

    renderModal();

    expect(await screen.findByText("42.2876 deg / -73.3662 deg")).toBeVisible();
    expect(screen.getByText("Edit location and weather data in the Climate tab.")).toBeVisible();
    // Editing affordances moved to the Climate tab (D-CL-3).
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByRole("button", { name: "Upload EPW" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save location" })).toBeNull();
  });

  test("renders the location summary for viewers", async () => {
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
  });
});
