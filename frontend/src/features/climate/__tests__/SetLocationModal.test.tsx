import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import {
  LOCATION_PROJECT as PROJECT,
  SET_LOCATION,
  UNSET_LOCATION,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import { SetLocationModal } from "../components/SetLocationModal";

const fetchMock = vi.fn();
const LOCATION_URL = `/api/v1/projects/${PROJECT.id}/location`;
const GEOCODE_URL = `${LOCATION_URL}/geocode`;
const ELEVATION_URL = `${LOCATION_URL}/elevation`;

const STOCKBRIDGE_CANDIDATE = {
  label: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
  latitude: 42.325,
  longitude: -73.367,
  site_address: "1 MAIN ST, WEST STOCKBRIDGE, MA, 01266",
  city: "WEST STOCKBRIDGE",
  state: "MA",
  country: "US",
  source: "census_geocoder",
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
  await user.type(await screen.findByLabelText("Site address"), "1 Main St");
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
      if (url === LOCATION_URL) return jsonResponse(UNSET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    renderModal();

    // No coordinates yet → the save action is disabled.
    expect(screen.getByRole("button", { name: /Save Location/ })).toBeDisabled();
    await user.type(await screen.findByLabelText("Site address"), "1 Main St");
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
