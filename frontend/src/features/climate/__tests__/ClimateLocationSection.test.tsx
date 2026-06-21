import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import type { ProjectDetail } from "../../projects/types";
import {
  LOCATION_PROJECT as PROJECT,
  SET_LOCATION,
  UNSET_LOCATION,
  deferredResponse,
  jsonResponse,
  stubCrypto,
} from "../../projects/testing/locationFixtures";
import { ClimateLocationSection } from "../components/ClimateLocationSection";

const fetchMock = vi.fn();

function renderSection({
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
        <ClimateLocationSection project={project} />
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ClimateLocationSection", () => {
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
      return jsonResponse({}, 404);
    });

    renderSection();

    await user.type(await screen.findByLabelText("Latitude"), "42.2876");
    delayedLocation.resolve();
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue("42.2876"));
    await user.click(screen.getByRole("button", { name: "Save location" }));

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
      return jsonResponse({}, 404);
    });

    renderSection({ unitSystem: "IP" });

    await user.type(await screen.findByLabelText("Latitude"), "42.2876");
    await user.type(screen.getByLabelText("Longitude"), "-73.3662");
    await user.type(screen.getByLabelText("Elevation (ft)"), "1000");
    await user.type(screen.getByLabelText("Time zone"), "America/New_York");
    await user.type(screen.getByLabelText("True north (deg)"), "8");
    await user.type(screen.getByLabelText("Site address"), "1 Main St");
    await user.type(screen.getByLabelText("City"), "West Stockbridge");
    await user.type(screen.getByLabelText("State"), "MA");
    await user.click(screen.getByRole("button", { name: "Save location" }));

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
    // The warnings returned by the save are surfaced in the tab.
    expect(
      await screen.findByText("Weather file location differs from project location."),
    ).toBeVisible();
  });

  test("uploads an EPW, applies parsed values, and saves the EPW link", async () => {
    stubCrypto();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/assets/upload-intent`) {
        return jsonResponse({
          asset: {
            id: "asset_epw",
            object_key: "projects/test/assets/asset_epw.epw",
            original_filename: "west-stockbridge.epw",
            display_name: "west-stockbridge.epw",
            content_type: "text/plain",
            size_bytes: 10,
            upload_status: "pending",
            metadata: {},
          },
          upload_url: "https://fake-r2.test/upload",
          expires_at: "2026-06-12T20:00:00Z",
          duplicate_of: null,
        });
      }
      if (url === "https://fake-r2.test/upload") return Promise.resolve({ ok: true, status: 200 });
      if (url === `/api/v1/projects/${PROJECT.id}/assets/asset_epw/complete-upload`) {
        return jsonResponse({});
      }
      if (url === `/api/v1/projects/${PROJECT.id}/location/epw/parse?asset_id=asset_epw`) {
        return jsonResponse({
          asset_id: "asset_epw",
          filename: "west-stockbridge.epw",
          suggestion: {
            latitude: 42.2876,
            longitude: -73.3662,
            elevation_m: 305,
            time_zone: "America/New_York",
            time_zone_offset_hours: -5,
            city: "West Stockbridge",
            state: "MA",
            country: "USA",
            source: "TMYx",
            wmo: "725060",
          },
        });
      }
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
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });

    const view = renderSection();

    await screen.findByLabelText("Latitude");
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(["LOCATION,..."], "west-stockbridge.epw", { type: "text/plain" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("LOCATION,...").buffer,
    });
    await user.upload(input as HTMLInputElement, file);
    await user.click(await screen.findByRole("button", { name: "Apply EPW values" }));
    await user.type(screen.getByLabelText("EPW source URL"), "https://climate.onebuilding.org/");
    await user.click(screen.getByRole("button", { name: "Save location" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url, init]) => {
          if (url !== `/api/v1/projects/${PROJECT.id}/location`) return false;
          const request = init as RequestInit | undefined;
          if (request?.method !== "PUT") return false;
          const body = JSON.parse(String(request.body));
          return (
            body.latitude === 42.2876 &&
            body.longitude === -73.3662 &&
            body.elevation_m === 305 &&
            body.time_zone === "America/New_York" &&
            body.city === "West Stockbridge" &&
            body.state === "MA" &&
            body.epw_asset_id === "asset_epw" &&
            body.epw_source_url === "https://climate.onebuilding.org/"
          );
        }),
      ).toBe(true);
    });
  });

  test("blocks hard-invalid location values before save", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });

    renderSection();

    await user.type(await screen.findByLabelText("Latitude"), "91");

    expect(screen.getByText("Latitude must be between -90 and 90 degrees.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save location" })).toBeDisabled();
  });

  test("finds location candidates with street, city, and state context", async () => {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) return jsonResponse(UNSET_LOCATION);
      if (url === `/api/v1/projects/${PROJECT.id}/location/geocode`) {
        expect(JSON.parse(String(init?.body))).toEqual({
          query: "1 Main St, West Stockbridge, MA",
        });
        return jsonResponse({
          candidates: [
            {
              label: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
              latitude: 42.325,
              longitude: -73.367,
              site_address: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
              city: "WEST STOCKBRIDGE",
              state: "MA",
              country: "US",
              source: "census_geocoder",
            },
          ],
        });
      }
      return jsonResponse({}, 404);
    });

    renderSection();

    await user.type(await screen.findByLabelText("Site address"), "1 Main St");
    await user.type(screen.getByLabelText("City"), "West Stockbridge");
    await user.type(screen.getByLabelText("State"), "MA");
    await user.click(screen.getByRole("button", { name: "Find" }));

    expect(
      await screen.findByRole("button", { name: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266" }),
    ).toBeVisible();
  });

  test("renders viewer location read-only with no write affordances", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${PROJECT.id}/location`) {
        return jsonResponse({
          ...SET_LOCATION,
          epw_asset_id: "asset_epw",
          epw_source_url: "https://climate.onebuilding.org/",
          epw: {
            id: "asset_epw",
            filename: "west-stockbridge.epw",
            source_url: "https://climate.onebuilding.org/",
            parsed_location: null,
          },
        });
      }
      return jsonResponse({}, 404);
    });

    renderSection({ project: { ...PROJECT, access_mode: "viewer" }, unitSystem: "IP" });

    expect(await screen.findByText("42.2876 deg / -73.3662 deg")).toBeVisible();
    expect(screen.getByText("1000.0 ft")).toBeVisible();
    expect(screen.getByRole("link", { name: "west-stockbridge.epw" })).toHaveAttribute(
      "href",
      `/api/v1/projects/${PROJECT.id}/assets/asset_epw/download`,
    );
    expect(screen.queryByRole("button", { name: "Upload EPW" })).toBeNull();
    expect(screen.queryByLabelText("Latitude")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save location" })).toBeNull();
  });
});
