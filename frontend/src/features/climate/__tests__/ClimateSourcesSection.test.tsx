import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetail, ProjectLocation } from "../../projects/types";
import { LOCATION_PROJECT as PROJECT, jsonResponse } from "../../projects/testing/locationFixtures";
import { ClimateSourcesSection } from "../components/ClimateSourcesSection";
import type { ProjectClimateSource } from "../types";

const fetchMock = vi.fn();

const ASHRAE_SOURCE: ProjectClimateSource = {
  id: "src-ashrae",
  project_id: PROJECT.id,
  kind: "ashrae",
  ref: "725060",
  label: "ASHRAE A",
  is_default: true,
  data: null,
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:00:00Z",
};

const PHIUS_SOURCE: ProjectClimateSource = {
  ...ASHRAE_SOURCE,
  id: "src-phius",
  kind: "phius",
  ref: "loc-worcester",
  label: "Worcester",
  is_default: false,
  data: {
    distance_mi: 12.3,
    elevation_delta_ft: 88,
    status: "pass",
    message: "Phius climate set is within 50 mi and 400 ft.",
  },
};

const SOURCES_URL = `/api/v1/projects/${PROJECT.id}/climate/sources`;

function locationWithEpw(): ProjectLocation {
  return {
    is_set: true,
    latitude: 42.2876,
    longitude: -73.3662,
    elevation_m: 304.8,
    time_zone: "America/New_York",
    true_north_deg: 0,
    site_address: null,
    city: null,
    state: null,
    county: null,
    county_fips: null,
    country: null,
    climate_zone: null,
    geodata_provenance: {},
    epw_asset_id: "asset_epw",
    epw_source_url: null,
    updated_at: "2026-06-14T10:00:00Z",
    epw: {
      id: "asset_epw",
      filename: "west-stockbridge.epw",
      source_url: null,
      parsed_location: null,
    },
  };
}

function renderSection({
  project = PROJECT,
  location,
  onAttach = vi.fn(),
}: {
  project?: ProjectDetail;
  location?: ProjectLocation;
  onAttach?: (body: unknown) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ClimateSourcesSection
        project={project}
        location={location}
        onAttach={onAttach}
        isAttaching={false}
        attachError={null}
      />
    </QueryClientProvider>,
  );
  return { onAttach };
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ClimateSourcesSection", () => {
  test("renders the roster with the default reflected", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === SOURCES_URL) {
        return jsonResponse({ items: [ASHRAE_SOURCE, PHIUS_SOURCE] });
      }
      return jsonResponse({}, 404);
    });

    renderSection();

    expect(await screen.findByText("ASHRAE A")).toBeVisible();
    expect(screen.getByText("Worcester")).toBeVisible();
    expect(screen.getByText(/12.3 mi/)).toBeVisible();
    expect(screen.getByText(/88 ft elev delta/)).toBeVisible();
    expect(screen.getByLabelText("Set ASHRAE source as default")).toBeChecked();
    expect(screen.getByLabelText("Set Phius source as default")).not.toBeChecked();
  });

  test("attaches an ASHRAE station via onAttach", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => jsonResponse({ items: [] }));
    const user = userEvent.setup();
    const { onAttach } = renderSection();

    await user.type(await screen.findByLabelText("ASHRAE station id"), "725060");
    await user.type(screen.getByLabelText("ASHRAE URL"), "https://ashrae-meteo.info/x");
    await user.click(screen.getByRole("button", { name: "Attach" }));

    expect(onAttach).toHaveBeenCalledWith({
      kind: "ashrae",
      ref: "725060",
      label: "725060",
      data: { url: "https://ashrae-meteo.info/x" },
    });
  });

  test("attaches the project EPW when one is linked", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => jsonResponse({ items: [] }));
    const user = userEvent.setup();
    const { onAttach } = renderSection({ location: locationWithEpw() });

    await user.click(await screen.findByRole("button", { name: "Attach west-stockbridge.epw" }));

    expect(onAttach).toHaveBeenCalledWith({
      kind: "epw",
      ref: "asset_epw",
      label: "west-stockbridge.epw",
    });
  });

  test("sets a source as default", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${SOURCES_URL}/${PHIUS_SOURCE.id}/default` && init?.method === "PUT") {
        return jsonResponse({ ...PHIUS_SOURCE, is_default: true });
      }
      if (url === SOURCES_URL) return jsonResponse({ items: [ASHRAE_SOURCE, PHIUS_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText("Set Phius source as default"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === `${SOURCES_URL}/${PHIUS_SOURCE.id}/default` &&
            (init as RequestInit | undefined)?.method === "PUT",
        ),
      ).toBe(true),
    );
  });

  test("removes a source", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${SOURCES_URL}/${ASHRAE_SOURCE.id}` && init?.method === "DELETE") {
        return jsonResponse(undefined, 204);
      }
      if (url === SOURCES_URL) return jsonResponse({ items: [ASHRAE_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByLabelText("Remove ASHRAE source"));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === `${SOURCES_URL}/${ASHRAE_SOURCE.id}` &&
            (init as RequestInit | undefined)?.method === "DELETE",
        ),
      ).toBe(true),
    );
  });

  test("viewer sees the roster read-only with no write affordances", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === SOURCES_URL) return jsonResponse({ items: [ASHRAE_SOURCE] });
      return jsonResponse({}, 404);
    });

    renderSection({ project: { ...PROJECT, access_mode: "viewer" } });

    expect(await screen.findByText("ASHRAE A")).toBeVisible();
    expect(screen.getByLabelText("Set ASHRAE source as default")).toBeDisabled();
    expect(screen.queryByLabelText("Remove ASHRAE source")).toBeNull();
    expect(screen.queryByText("Attach ASHRAE station")).toBeNull();
  });
});
