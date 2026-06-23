import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
import type { ClimateDatasetRosterResponse, PhClimateKind, ProjectClimateSource } from "../types";

const fetchMock = vi.fn();

const SOURCES_URL = `/api/v1/projects/${PROJECT.id}/climate/sources`;
const LOCATION_URL = `/api/v1/projects/${PROJECT.id}/location`;
const PHIUS_LOCATION_URL = "/api/v1/climate/datasets/dataset-phius/locations/location-phius";
const PHI_LOCATION_URL = "/api/v1/climate/datasets/dataset-phi/locations/location-phi";

const WEATHER_SOURCE: ProjectClimateSource = {
  id: "src-weather",
  project_id: PROJECT.id,
  kind: "weather",
  ref: "asset-epw",
  label: "Pittsfield.Muni.AP",
  data: {
    source_url: "https://climate.onebuilding.org/pittsfield.zip",
    station: { name: "Pittsfield.Muni.AP" },
    stat_metrics: {
      hdd65_f_days: 3884,
      cdd50_f_days: 1275,
      record_low_c: -22.9,
      record_high_c: 32.3,
    },
    design_conditions: {
      basis: "ASHRAE Meteo 2025 / PITTSFIELD MUNI AP",
      heating_996_db_c: -18.8,
      heating_990_db_c: -17.1,
      cooling_004_db_c: 30.7,
      cooling_004_mcwb_c: 21.6,
      cooling_010_db_c: 28.5,
      cooling_010_mcwb_c: 21.2,
      cooling_020_db_c: 27.2,
      cooling_020_mcwb_c: 20.2,
      dehumidification_010_dp_c: 20.8,
      dehumidification_010_mcdb_c: 24.8,
    },
  },
  created_at: "2026-06-14T10:00:00Z",
  updated_at: "2026-06-14T10:00:00Z",
};

const PHIUS_SOURCE: ProjectClimateSource = {
  ...WEATHER_SOURCE,
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

const PHI_SOURCE: ProjectClimateSource = {
  ...WEATHER_SOURCE,
  id: "src-phi",
  kind: "phi",
  ref: "location-phi",
  label: "Boston",
  data: {
    dataset_id: "dataset-phi",
    dataset: { provider: "phi", version: "10.6", label: "PHI 10.6" },
    proximity: {
      distance_mi: 113.8,
      elevation_delta_ft: 115,
      status: "warning",
      message: "Confirm PHI climate-set representativeness with the certifier.",
    },
  },
};

function sourceAfterAttach(kind: PhClimateKind): ProjectClimateSource {
  return kind === "phius"
    ? {
        ...PHIUS_SOURCE,
        id: "src-attached-phius",
        ref: "location-phius",
      }
    : {
        ...PHI_SOURCE,
        id: "src-attached-phi",
        ref: "location-phi",
      };
}

function rosterForAttach(kind: PhClimateKind): ClimateDatasetRosterResponse {
  return {
    dataset:
      kind === "phius"
        ? { id: "dataset-phius", provider: "phius", version: "2022", label: "Phius 2022" }
        : { id: "dataset-phi", provider: "phi", version: "10.6", label: "PHI 10.6" },
    project: {
      latitude: SET_LOCATION.latitude ?? 42.28,
      longitude: SET_LOCATION.longitude ?? -73.36,
      elevation_m: SET_LOCATION.elevation_m,
      state: SET_LOCATION.state,
    },
    items: [
      {
        id: kind === "phius" ? "location-phius" : "location-phi",
        name: kind === "phius" ? "NEW YORK CENTRAL PRK OBS BELV NY" : "Boston",
        region: kind === "phius" ? "NY" : "MA",
        station_id: kind === "phius" ? "NYC" : "US0035a",
        latitude: 42.3,
        longitude: -73.3,
        elevation_m: 300,
        climate_zone: "5A",
        proximity: {
          distance_mi: 4.2,
          elevation_delta_ft: 118,
          status: kind === "phius" ? "pass" : "warning",
          message:
            kind === "phius"
              ? "Phius climate set is within 50 mi and 400 ft."
              : "Confirm PHI climate-set representativeness with the certifier.",
        },
      },
    ],
    total: 1,
  };
}

function climateLocationDetail(
  source: ProjectClimateSource,
  datasetId: string,
  name: string,
  region: string,
) {
  return {
    ...source,
    id: source.ref,
    dataset_id: datasetId,
    name,
    region,
    record: makeClimateRecord({ display_name: name }),
  };
}

function phiusLocationDetail(source = PHIUS_SOURCE) {
  return climateLocationDetail(
    source,
    "dataset-phius",
    source.label ?? "NEW YORK CENTRAL PRK OBS BELV NY",
    "NY",
  );
}

function phiLocationDetail(source = PHI_SOURCE) {
  return climateLocationDetail(source, "dataset-phi", source.label ?? "Boston", "MA");
}

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
      if (url === PHIUS_LOCATION_URL) return jsonResponse(phiusLocationDetail());
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
      if (url === PHIUS_LOCATION_URL) return jsonResponse(phiusLocationDetail());
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

  test("renders PHI advisory checks with the same limit table UI", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [PHI_SOURCE] });
      if (url === PHI_LOCATION_URL) return jsonResponse(phiLocationDetail());
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab(PROJECT, "IP");

    await user.click(await screen.findByRole("button", { name: /Boston/ }));

    const limitCheck = await screen.findByRole("table", { name: "PHI advisory limits" });
    expect(
      within(limitCheck).getByRole("row", { name: /^Distance 113\.8 mi 50 mi check$/i }),
    ).toBeVisible();
    expect(
      within(limitCheck).getByRole("row", { name: /^Elevation 115 ft 400 ft pass$/i }),
    ).toBeVisible();
  });

  test.each([
    { kind: "phius" as const, label: "Phius", tableName: "Phius certification limits" },
    { kind: "phi" as const, label: "PHI", tableName: "PHI advisory limits" },
  ])(
    "navigates to the $label page after selecting a dataset from the modal",
    async ({ kind, label, tableName }) => {
      vi.stubGlobal("fetch", fetchMock);
      let sources: ProjectClimateSource[] = [];
      const attachedSource = sourceAfterAttach(kind);
      fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
        if (url === SOURCES_URL && (init?.method ?? "GET") === "GET") {
          return jsonResponse({ items: sources });
        }
        if (url === SOURCES_URL && init?.method === "POST") {
          sources = [attachedSource];
          return jsonResponse(attachedSource, 201);
        }
        if (url.startsWith(`/api/v1/projects/${PROJECT.id}/climate/datasets/${kind}/locations`)) {
          return jsonResponse(rosterForAttach(kind));
        }
        if (url === (kind === "phius" ? PHIUS_LOCATION_URL : PHI_LOCATION_URL)) {
          return jsonResponse(
            kind === "phius"
              ? phiusLocationDetail(attachedSource)
              : phiLocationDetail(attachedSource),
          );
        }
        return jsonResponse({}, 404);
      });
      const user = userEvent.setup();

      renderTab(PROJECT, "IP");

      const missingCard = (await screen.findByText(label)).closest("button");
      expect(missingCard).not.toBeNull();
      await user.click(missingCard as HTMLButtonElement);
      // The empty-state page opens the climate-data modal, which hosts manual selection.
      await user.click(await screen.findByRole("button", { name: `Set ${label} Climate Data` }));
      await user.click(await screen.findByRole("button", { name: /^NEW YORK CENTRAL|^Boston/ }));
      await user.click(screen.getByRole("button", { name: "Attach" }));

      expect(await screen.findByRole("table", { name: tableName })).toBeVisible();
      expect(screen.queryByRole("dialog", { name: `Set ${label} Climate Data` })).toBeNull();
    },
  );

  test("keeps failing Phius datasets on the normal data page with an override warning", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [FAILING_PHIUS_SOURCE] });
      if (url === PHIUS_LOCATION_URL)
        return jsonResponse(phiusLocationDetail(FAILING_PHIUS_SOURCE));
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

  test("routes from location to the merged Weather File detail page", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [WEATHER_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    await user.click(await screen.findByRole("button", { name: /Pittsfield\.Muni\.AP/ }));

    expect(await screen.findByText("HDD65")).toBeVisible();
    expect(screen.getByText("Htg 99.6% DB")).toBeVisible();
    expect(screen.getByText("-18.8 deg C")).toBeVisible();
    expect(screen.getByText("Clg 0.4% DB")).toBeVisible();
    expect(screen.getByText("ASHRAE Meteo 2025 / PITTSFIELD MUNI AP")).toBeVisible();
    const selectedWeatherCard = screen
      .getByRole("button", { name: /Pittsfield\.Muni\.AP/ })
      .closest(".climate-source-card") as HTMLElement;
    const card = within(selectedWeatherCard);
    expect(card.getByRole("button", { name: "Select from Map" })).toBeVisible();
    expect(card.getByRole("button", { name: "Upload Climate Data" })).toBeVisible();
    expect(card.getByRole("button", { name: /Clear Weather File Climate Data/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Set from nearest weather file" })).toBeNull();
    expect(screen.getByText("Download EPW")).toBeVisible();
    expect(screen.getByText("Open OneBuilding source")).toBeVisible();
  });

  test("renders the location facts, source status chips, and reveals the editor", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [WEATHER_SOURCE] });
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    expect(await screen.findByText("Berkshire · MA")).toBeVisible();
    expect(screen.getByText("1 Main St")).toBeVisible();
    expect(screen.getByText("West Stockbridge, MA 01266")).toBeVisible();
    expect(screen.getByText("(private)")).toBeVisible();
    expect(screen.queryByText("1 Main St, West Stockbridge, MA, 01266")).toBeNull();
    expect(screen.getAllByText("5A").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /Locate Climate Data/ })).toBeNull();

    const weatherCard = screen.getByText("Pittsfield.Muni.AP").closest("button");
    await user.click(weatherCard as HTMLButtonElement);
    expect(await screen.findByRole("heading", { name: "Pittsfield.Muni.AP" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Set Location/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Project location/ }));
    await user.click(screen.getByRole("button", { name: /Set Location/ }));
    expect(await screen.findByLabelText("Latitude")).toBeVisible();
    const dialog = screen.getByRole("dialog", { name: /Set project location/ });
    expect(within(dialog).getByRole("button", { name: /Save Location/ })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("group", { name: "Project location map" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Pittsfield.Muni.AP" })).toBeNull();
  });

  test("finds nearest in the climate-data modal, then attaches after confirmation", async () => {
    vi.stubGlobal("fetch", fetchMock);
    let sources: ProjectClimateSource[] = [];
    const attached: ProjectClimateSource = { ...PHIUS_SOURCE, id: "src-derived-phius" };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL && (init?.method ?? "GET") === "GET") {
        return jsonResponse({ items: sources });
      }
      if (url === SOURCES_URL && init?.method === "POST") {
        sources = [attached];
        return jsonResponse(attached, 201);
      }
      if (url.startsWith(`/api/v1/projects/${PROJECT.id}/climate/datasets/phius/locations`)) {
        return jsonResponse(rosterForAttach("phius"));
      }
      if (url === PHIUS_LOCATION_URL) return jsonResponse(phiusLocationDetail(attached));
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab(PROJECT, "IP");

    const missingCard = (await screen.findByText("Phius")).closest("button");
    await user.click(missingCard as HTMLButtonElement);
    await user.click(await screen.findByRole("button", { name: "Set Phius Climate Data" }));
    await user.click(await screen.findByRole("button", { name: "Find Nearest" }));

    expect(await screen.findByRole("button", { name: /^NEW YORK CENTRAL/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Attach" }));

    // The nearest action only selects; the explicit attach hands off to detail.
    expect(await screen.findByRole("table", { name: "Phius certification limits" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "NEW YORK CENTRAL PRK OBS BELV NY, NY" }),
    ).toBeVisible();
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
    expect(screen.queryByText("1 Main St")).toBeNull();
    expect(screen.queryByRole("button", { name: /No source attached/ })).toBeNull();
    expect(screen.queryByText("Set Phius Climate Data")).toBeNull();
  });
});
