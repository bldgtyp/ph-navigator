// @size-exception: planning/archive/2026-07-15/project-location-town-search/phases/phase-02-modal-town-search.md
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import {
  ADDRESS_GEOCODE_CANDIDATE,
  LOCATION_PROJECT as PROJECT,
  LOCALITY_GEOCODE_CANDIDATE,
  SET_LOCATION,
  UNSET_LOCATION,
  deferredResponse,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import { SetLocationModal } from "../components/SetLocationModal";

vi.mock("../components/ClimateMap", () => ({
  ClimateMap: ({
    project,
    onPickPoint,
  }: {
    project: { latitude: number; longitude: number } | null;
    onPickPoint?: (latitude: number, longitude: number) => void;
  }) => (
    <button
      type="button"
      aria-label="Test map pin drop"
      disabled={!project}
      onClick={() => onPickPoint?.(42.31, -73.39)}
    >
      Map
    </button>
  ),
}));

const fetchMock = vi.fn();
const LOCATION_URL = `/api/v1/projects/${PROJECT.id}/location`;
const GEOCODE_URL = `${LOCATION_URL}/geocode`;
const ELEVATION_URL = `${LOCATION_URL}/elevation`;

const STOCKBRIDGE_CANDIDATE = ADDRESS_GEOCODE_CANDIDATE;
const TOWN_CANDIDATE = LOCALITY_GEOCODE_CANDIDATE;

const TOWN_LOCATION = {
  ...SET_LOCATION,
  latitude: TOWN_CANDIDATE.latitude,
  longitude: TOWN_CANDIDATE.longitude,
  street_address: null,
  full_site_address: "West Stockbridge, MA 01266",
};

const OLD_ADDRESS_LOCATION = {
  ...SET_LOCATION,
  street_address: "10 State St",
  city: "Albany",
  state: "NY",
  postal_code: "12207",
  full_site_address: "10 State St, Albany, NY 12207",
};

function isMethod(init: unknown, method: string): boolean {
  return (init as RequestInit | undefined)?.method === method;
}

function elevationPostCount(): number {
  return fetchMock.mock.calls.filter(
    ([url, init]) => url === ELEVATION_URL && isMethod(init, "POST"),
  ).length;
}

// Apply the one Stockbridge candidate through the address search flow, leaving
// valid coordinates that drive the elevation auto-fill.
async function applyCandidate(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(await screen.findByLabelText("Address or town"), "1 Main St");
  await user.click(screen.getByRole("button", { name: /Search/ }));
  await user.click(await screen.findByRole("button", { name: /1 MAIN ST, WEST STOCKBRIDGE/ }));
}

function renderModal({ unitSystem = "SI" }: { unitSystem?: UnitSystem } = {}) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
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
        <SetLocationModal projectId={PROJECT.id} onClose={onClose} />
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
  return { onClose };
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("SetLocationModal", () => {
  test("town query stays separate from street persistence and saves a null street", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [TOWN_CANDIDATE] });
      if (url === ELEVATION_URL) {
        return jsonResponse({ elevation_m: 302, source: "usgs_epqs", warning: null });
      }
      if (url === LOCATION_URL && isMethod(init, "PUT")) {
        return jsonResponse({ location: TOWN_LOCATION, warnings: [] });
      }
      if (url === LOCATION_URL) return jsonResponse(OLD_ADDRESS_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    const searchInput = await screen.findByLabelText("Address or town");
    await waitFor(() => expect(searchInput).toHaveValue(OLD_ADDRESS_LOCATION.full_site_address));
    await user.clear(searchInput);
    await user.type(searchInput, "  West Stockbridge, MA 01266  ");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    await user.click(await screen.findByRole("button", { name: /West Stockbridge, MA 01266/ }));

    expect(searchInput).toHaveValue("West Stockbridge, MA 01266");
    expect(screen.getByText(/Town-level location/)).toBeVisible();
    const geocodeCall = fetchMock.mock.calls.find(([url]) => url === GEOCODE_URL);
    expect(JSON.parse(String((geocodeCall?.[1] as RequestInit).body))).toEqual({
      query: "West Stockbridge, MA 01266",
    });

    await user.click(screen.getByRole("button", { name: /Save Location/ }));
    const saveCall = await waitFor(() => {
      const match = fetchMock.mock.calls.find(
        ([url, init]) => url === LOCATION_URL && isMethod(init, "PUT"),
      );
      expect(match).toBeTruthy();
      return match;
    });
    expect(JSON.parse(String((saveCall?.[1] as RequestInit).body))).toMatchObject({
      latitude: 42.312354,
      longitude: -73.388044,
      street_address: null,
      city: "West Stockbridge",
      state: "MA",
      postal_code: "01266",
    });
  });

  test("renders address-or-town no-match and provider failure copy", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [] });
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Address or town"), "Not A Place, MA");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    expect(await screen.findByText(/No address or town matches/)).toBeVisible();
    expect(screen.queryByText(/needs a full street address/)).not.toBeInTheDocument();
  });

  test("shows the actionable Census address failure", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) {
        return jsonResponse(
          {
            error_code: "geocoder_unavailable",
            message:
              "Address search is temporarily unavailable; retry or enter coordinates manually.",
            request_id: "req-test",
            details: {},
          },
          502,
        );
      }
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Address or town"), "1 Main St, Nowhere, MA");
    await user.click(screen.getByRole("button", { name: /Search/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /retry or enter coordinates manually/,
    );
  });

  test("reopens a streetless location with useful neutral saved-point text", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === LOCATION_URL) return jsonResponse(TOWN_LOCATION);
      return jsonResponse({}, 404);
    });
    renderModal();

    const searchInput = await screen.findByLabelText("Address or town");
    await waitFor(() => expect(searchInput).toHaveValue("West Stockbridge, MA 01266"));
    expect(screen.getByText(/Saved project point/)).toBeVisible();
    expect(screen.queryByText(/Town-level location/)).not.toBeInTheDocument();
  });

  test("late location data does not overwrite in-progress search typing", async () => {
    const deferred = deferredResponse(SET_LOCATION);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === LOCATION_URL) return deferred.response;
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    const searchInput = screen.getByLabelText("Address or town");
    await user.type(searchInput, "My private town query");
    deferred.resolve();
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue("42.2876"));
    expect(searchInput).toHaveValue("My private town query");
  });

  test("drops stale geocode results when the query changes in flight", async () => {
    const deferred = deferredResponse({ candidates: [TOWN_CANDIDATE] });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) return deferred.response;
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    const searchInput = await screen.findByLabelText("Address or town");
    await user.type(searchInput, "West Stockbridge, MA");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    await user.clear(searchInput);
    await user.type(searchInput, "A different town, MA");
    deferred.resolve();

    await waitFor(() => expect(screen.getByRole("button", { name: /Search/ })).toBeEnabled());
    expect(searchInput).toHaveValue("A different town, MA");
    expect(
      screen.queryByRole("button", { name: /West Stockbridge, MA 01266/ }),
    ).not.toBeInTheDocument();
  });

  test("direct coordinate edits and pin refinement use custom-point privacy copy", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === LOCATION_URL) return jsonResponse(TOWN_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    const latitude = await screen.findByLabelText("Latitude");
    await waitFor(() => expect(latitude).toHaveValue("42.312354"));
    await user.clear(latitude);
    await user.type(latitude, "42.32");
    expect(screen.getByText(/Custom project point/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Test map pin drop" }));
    expect(screen.getByLabelText("Latitude")).toHaveValue("42.310000");
    expect(screen.getByText(/shown on the project map/)).toBeVisible();
  });

  test("a new locality restores town-level copy after a custom edit", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [TOWN_CANDIDATE] });
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Latitude"), "42");
    await user.type(screen.getByLabelText("Longitude"), "-73");
    expect(screen.getByText(/Custom project point/)).toBeVisible();
    await user.type(screen.getByLabelText("Address or town"), "West Stockbridge, MA");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    await user.click(await screen.findByRole("button", { name: /West Stockbridge/ }));
    expect(screen.getByText(/Town-level location/)).toBeVisible();
  });

  test("mixed candidates are visibly classified as address or town", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) {
        return jsonResponse({ candidates: [STOCKBRIDGE_CANDIDATE, TOWN_CANDIDATE] });
      }
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Address or town"), "West Stockbridge, MA");
    await user.click(screen.getByRole("button", { name: /Search/ }));

    expect(await screen.findByText("Address")).toBeVisible();
    expect(screen.getByText("Town")).toBeVisible();
    expect(screen.getByText("2 location search results available.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.queryByText(/ZIP area/i)).not.toBeInTheDocument();
  });

  test("save location persists edits and closes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === LOCATION_URL && isMethod(init, "PUT")) {
        return jsonResponse({ location: SET_LOCATION, warnings: [] });
      }
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();

    // Coordinates load from the saved location (async load-sync effect).
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue("42.2876"));
    await user.clear(screen.getByLabelText("Latitude"));
    await user.type(screen.getByLabelText("Latitude"), "42.3");
    await user.click(screen.getByRole("button", { name: /Save Location/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => url === LOCATION_URL && isMethod(init, "PUT")),
      ).toBe(true),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("address search applies a candidate's coordinates", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === GEOCODE_URL) {
        return jsonResponse({
          candidates: [
            {
              result_type: "address",
              label: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
              latitude: 42.325,
              longitude: -73.367,
              street_address: "1 MAIN ST",
              city: "WEST STOCKBRIDGE",
              state: "MA",
              postal_code: "01266",
              full_site_address: "1 MAIN ST, WEST STOCKBRIDGE, MA 01266",
              country: "US",
              source: "census_geocoder",
            },
          ],
        });
      }
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    // No coordinates yet → the save action is disabled.
    expect(screen.getByRole("button", { name: /Save Location/ })).toBeDisabled();
    await user.type(await screen.findByLabelText("Address or town"), "1 Main St");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    await user.click(await screen.findByRole("button", { name: /1 MAIN ST, WEST STOCKBRIDGE/ }));

    expect(screen.getByLabelText("Latitude")).toHaveValue("42.325");
    expect(screen.getByLabelText("Longitude")).toHaveValue("-73.367");
    expect(screen.getByRole("button", { name: /Save Location/ })).toBeEnabled();
  });

  test("cancel closes the modal without persisting", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await screen.findByLabelText("Latitude");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([url, init]) => url === LOCATION_URL && isMethod(init, "PUT")),
    ).toBe(false);
  });

  test("blocks save on an out-of-range coordinate", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(await screen.findByLabelText("Latitude"), "91");

    expect(screen.getByText("Latitude must be between -90 and 90 degrees.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Save Location/ })).toBeDisabled();
  });
});

describe("SetLocationModal — elevation auto-fill", () => {
  test("auto-fills elevation from the coordinates after applying a candidate", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ELEVATION_URL && isMethod(init, "POST")) {
        return jsonResponse({ elevation_m: 302, source: "usgs_epqs", warning: null });
      }
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [STOCKBRIDGE_CANDIDATE] });
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await applyCandidate(user);

    await waitFor(() => expect(screen.getByLabelText(/Elevation/)).toHaveValue("302.0"), {
      timeout: 2000,
    });
    expect(screen.getByText(/USGS 3DEP/)).toBeInTheDocument();
  });

  test("keeps a manual elevation override when coordinates change", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ELEVATION_URL && isMethod(init, "POST")) {
        return jsonResponse({ elevation_m: 999, source: "usgs_epqs", warning: null });
      }
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByText(/Advanced/));
    const elevation = screen.getByLabelText(/Elevation/);
    await user.type(elevation, "250");
    expect(await screen.findByRole("button", { name: /Reset to auto/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Latitude"), "42.3");
    await user.type(screen.getByLabelText("Longitude"), "-73.3");

    // Let the debounce window elapse: the override must suppress any lookup.
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(elevation).toHaveValue("250");
    expect(elevationPostCount()).toBe(0);
  });

  test("Reset to auto re-derives elevation after an override", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ELEVATION_URL && isMethod(init, "POST")) {
        return jsonResponse({ elevation_m: 302, source: "usgs_epqs", warning: null });
      }
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [STOCKBRIDGE_CANDIDATE] });
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await applyCandidate(user);
    await waitFor(() => expect(screen.getByLabelText(/Elevation/)).toHaveValue("302.0"), {
      timeout: 2000,
    });

    await user.click(screen.getByText(/Advanced/));
    const elevation = screen.getByLabelText(/Elevation/);
    await user.clear(elevation);
    await user.type(elevation, "250");

    await user.click(await screen.findByRole("button", { name: /Reset to auto/ }));
    await waitFor(() => expect(elevation).toHaveValue("302.0"), { timeout: 2000 });
  });

  test("a failed elevation lookup leaves the field editable with a note", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ELEVATION_URL && isMethod(init, "POST")) {
        return jsonResponse({
          elevation_m: null,
          source: null,
          warning: "Could not derive site elevation from USGS EPQS or Open-Meteo.",
        });
      }
      if (url === GEOCODE_URL) return jsonResponse({ candidates: [STOCKBRIDGE_CANDIDATE] });
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    await applyCandidate(user);

    expect(
      await screen.findByText(/Could not derive site elevation/, undefined, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Elevation/)).toHaveValue("");
  });
});
