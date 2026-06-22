import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import {
  LOCATION_PROJECT as PROJECT,
  SET_LOCATION,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import { ClimateTab } from "../routes/ClimateTab";
import { makeClimateRecord } from "../testing/recordFixture";
import type { ProjectClimateSource } from "../types";

const fetchMock = vi.fn();

const SOURCES_URL = `/api/v1/projects/${PROJECT.id}/climate/sources`;
const LOCATION_URL = `/api/v1/projects/${PROJECT.id}/location`;
const DERIVE_URL = `${LOCATION_URL}/derive`;
const PHIUS_LOCATION_URL = "/api/v1/climate/datasets/dataset-phius/locations/location-phius";

const EPW_SOURCE: ProjectClimateSource = {
  id: "src-epw",
  project_id: PROJECT.id,
  kind: "epw",
  ref: "asset-epw",
  label: "Pittsfield.Muni.AP",
  data: {
    source_url: "https://climate.onebuilding.org/pittsfield.zip",
    stat_metrics: {
      hdd65_f_days: 3884,
      cdd50_f_days: 1275,
      record_low_c: -22.9,
      record_high_c: 32.3,
    },
  },
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:00:00Z",
};

const ASHRAE_SOURCE: ProjectClimateSource = {
  ...EPW_SOURCE,
  id: "src-ashrae",
  kind: "ashrae",
  ref: "725060",
  label: "Pittsfield ASHRAE",
  data: {
    url: "https://ashrae-meteo.info/v3.0/",
    design_conditions: {
      basis: "ASHRAE Meteo 2025 / PITTSFIELD MUNI AP",
      heating_996_db_c: -18.8,
      heating_990_db_c: -17.1,
      cooling_010_db_c: 28.5,
      cooling_010_mcwb_c: 21.2,
    },
  },
};

const PHIUS_SOURCE: ProjectClimateSource = {
  ...EPW_SOURCE,
  id: "src-phius",
  kind: "phius",
  ref: "location-phius",
  label: "NEW YORK CENTRAL PRK OBS BELV NY",
  data: {
    dataset_id: "dataset-phius",
    dataset: { provider: "phius", version: "2022", label: "Phius 2022" },
    proximity: {
      distance_mi: 4.2,
      elevation_delta_ft: 118,
      status: "pass",
      message: "Phius climate set is within 50 mi and 400 ft.",
    },
  },
};

const FAILING_PHIUS_SOURCE: ProjectClimateSource = {
  ...PHIUS_SOURCE,
  data: {
    ...PHIUS_SOURCE.data,
    proximity: {
      distance_mi: 113.8,
      elevation_delta_ft: 115,
      status: "fail",
      message: "No Phius set within 50 mi / 400 ft — custom set required ($75).",
    },
  },
};

function renderTab(project: typeof PROJECT = PROJECT, unitSystem: UnitSystem = "SI") {
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
        <ClimateTab project={project} />
      </UnitPreferenceContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("ClimateTab", () => {
  test("renders Phius monthly charts, monthly tables, and peak-load table", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [PHIUS_SOURCE] });
      if (url === PHIUS_LOCATION_URL) {
        return jsonResponse({
          ...PHIUS_SOURCE,
          record: makeClimateRecord({ display_name: "NEW YORK CENTRAL PRK OBS BELV NY" }),
        });
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    await user.click(await screen.findByRole("button", { name: /NEW YORK CENTRAL/ }));

    const limitCheck = await screen.findByRole("table", { name: "Phius certification limits" });
    expect(
      within(limitCheck).getByRole("row", { name: /^Distance 6\.8 km 80\.5 km pass$/i }),
    ).toBeVisible();
    expect(
      within(limitCheck).getByRole("row", { name: /^Elevation 36 m 122 m pass$/i }),
    ).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Monthly data" })).toBeVisible();
    expect(screen.getAllByText("Monthly temperatures").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Monthly radiation").length).toBeGreaterThanOrEqual(2);
    const temperatureElements = screen.getAllByText("Monthly temperatures");
    const radiationElements = screen.getAllByText("Monthly radiation");
    expect(
      temperatureElements[0]?.compareDocumentPosition(temperatureElements[1] ?? document.body),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      temperatureElements[1]?.compareDocumentPosition(radiationElements[0] ?? document.body),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      radiationElements[0]?.compareDocumentPosition(radiationElements[1] ?? document.body),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("heading", { name: "Peak loads" })).toBeVisible();
    expect(screen.getByRole("row", { name: /^Heating 1/ })).toBeVisible();
    expect(screen.getByRole("row", { name: /^Cooling 1/ })).toBeVisible();
  });

  test("renders Phius limit checks in IP units when the app unit switch is IP", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [PHIUS_SOURCE] });
      if (url === PHIUS_LOCATION_URL) {
        return jsonResponse({
          ...PHIUS_SOURCE,
          record: makeClimateRecord({ display_name: "NEW YORK CENTRAL PRK OBS BELV NY" }),
        });
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab(PROJECT, "IP");

    await user.click(await screen.findByRole("button", { name: /NEW YORK CENTRAL/ }));

    const limitCheck = await screen.findByRole("table", { name: "Phius certification limits" });
    expect(
      within(limitCheck).getByRole("row", { name: /^Distance 4\.2 mi 50 mi pass$/i }),
    ).toBeVisible();
    expect(
      within(limitCheck).getByRole("row", { name: /^Elevation 118 ft 400 ft pass$/i }),
    ).toBeVisible();
  });

  test("keeps failing Phius datasets on the normal data page with an override warning", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [FAILING_PHIUS_SOURCE] });
      if (url === PHIUS_LOCATION_URL) {
        return jsonResponse({
          ...FAILING_PHIUS_SOURCE,
          record: makeClimateRecord({ display_name: "NEW YORK CENTRAL PRK OBS BELV NY" }),
        });
      }
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab(PROJECT, "IP");

    await user.click(await screen.findByRole("button", { name: /NEW YORK CENTRAL/ }));

    expect(await screen.findByRole("heading", { name: "Monthly data" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Phius certification limits" })).toBeVisible();
    expect(
      screen.getByText("This climate dataset is outside the Phius distance/elevation limits."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Use this dataset anyway" })).toBeNull();
  });

  test("routes from location to attached EPW and ASHRAE detail pages", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [EPW_SOURCE, ASHRAE_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    expect(await screen.findByRole("button", { name: /Pittsfield\.Muni\.AP/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Pittsfield ASHRAE/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Pittsfield\.Muni\.AP/ }));
    expect(await screen.findByText("HDD65")).toBeVisible();
    expect(screen.getByText("3884")).toBeVisible();
    expect(screen.getByText("Weather file")).toBeVisible();
    expect(screen.getByLabelText("EPW source URL")).toBeVisible();
    expect(screen.getByRole("button", { name: /Upload EPW/ })).toBeVisible();
    expect(screen.getByText("Open OneBuilding source")).toHaveAttribute(
      "href",
      "https://climate.onebuilding.org/pittsfield.zip",
    );

    await user.click(screen.getByRole("button", { name: /Pittsfield ASHRAE/ }));
    expect(await screen.findByText("Htg 99.6% DB")).toBeVisible();
    expect(screen.getByText("-18.8 deg C")).toBeVisible();
    expect(screen.getByText("ASHRAE Meteo 2025 / PITTSFIELD MUNI AP")).toBeVisible();
  });

  test("renders the location facts, source status chips, and reveals the editor", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === DERIVE_URL && init?.method === "POST") {
        return jsonResponse({ location: SET_LOCATION, warnings: [] });
      }
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [EPW_SOURCE, ASHRAE_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    // Derived facts render read-first (county/state + climate zone). The zone
    // shows both in the sidebar location pill and the facts grid.
    expect(await screen.findByText("Berkshire · MA")).toBeVisible();
    expect(screen.getAllByText("5A").length).toBeGreaterThanOrEqual(1);
    // Both attached sources read as OK in the sidebar.
    expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(2);
    // The two unattached canonical types (Phius, PHI) still show as "Not set".
    expect(screen.getByText("Phius")).toBeVisible();
    expect(screen.getByText("PHI")).toBeVisible();
    expect(screen.getAllByText("Not set").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /Locate Climate Data/ })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Locate Climate Data/ }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url, init]) => url === DERIVE_URL && init?.method === "POST"),
      ).toBe(true),
    );
    // The editor is a modal, opened from "Set Location".
    expect(screen.queryByLabelText("Latitude")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Set Location/ }));
    expect(await screen.findByLabelText("Latitude")).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: /Set project location/ });
    expect(within(dialog).getByRole("button", { name: /Save Location/ })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: /Locate Climate Data/ })).toBeNull();
  });

  test("a viewer cannot open the dataset picker", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [] });
      return jsonResponse({}, 404);
    });

    renderTab({ ...PROJECT, access_mode: "viewer" });

    // The unattached Phius slot is shown, but as a static card — no picker entry.
    expect(await screen.findByText("Phius")).toBeVisible();
    expect(screen.queryByRole("button", { name: /No source attached/ })).toBeNull();
    expect(screen.queryByText("Select Phius climate dataset")).toBeNull();
  });
});
