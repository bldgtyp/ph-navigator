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
const DERIVE_URL = `${LOCATION_URL}/derive`;
const GEOCODE_URL = `${LOCATION_URL}/geocode`;

function isMethod(init: unknown, method: string): boolean {
  return (init as RequestInit | undefined)?.method === method;
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
  test("locate climate data runs the derive finder and closes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === DERIVE_URL) return jsonResponse({ location: SET_LOCATION, warnings: [] });
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();
    const { onClose } = renderModal();

    // Coordinates load from the saved location (async load-sync effect).
    await waitFor(() => expect(screen.getByLabelText("Latitude")).toHaveValue("42.2876"));
    await user.click(screen.getByRole("button", { name: /Locate Climate Data/ }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => url === DERIVE_URL && isMethod(init, "POST")),
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

    // No coordinates yet → the primary action is disabled.
    expect(screen.getByRole("button", { name: /Locate Climate Data/ })).toBeDisabled();
    await user.type(await screen.findByLabelText("Site address"), "1 Main St");
    await user.click(screen.getByRole("button", { name: /Search/ }));
    await user.click(
      await screen.findByRole("button", { name: /1 MAIN ST, WEST STOCKBRIDGE/ }),
    );

    expect(screen.getByLabelText("Latitude")).toHaveValue("42.325");
    expect(screen.getByLabelText("Longitude")).toHaveValue("-73.367");
    expect(screen.getByRole("button", { name: /Locate Climate Data/ })).toBeEnabled();
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
      fetchMock.mock.calls.some(
        ([url, init]) => url === DERIVE_URL || (url === LOCATION_URL && isMethod(init, "PUT")),
      ),
    ).toBe(false);
  });

  test("blocks locate on an out-of-range coordinate", async () => {
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
    expect(screen.getByRole("button", { name: /Locate Climate Data/ })).toBeDisabled();
  });
});
