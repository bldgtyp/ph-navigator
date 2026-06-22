import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import {
  LOCATION_PROJECT as PROJECT,
  SET_LOCATION,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import { ClimateTab } from "../routes/ClimateTab";
import type { ProjectClimateSource } from "../types";

const fetchMock = vi.fn();

const SOURCES_URL = `/api/v1/projects/${PROJECT.id}/climate/sources`;
const LOCATION_URL = `/api/v1/projects/${PROJECT.id}/location`;
const SUN_PATH_URL = `/api/v1/projects/${PROJECT.id}/sun-path`;

const EPW_SOURCE: ProjectClimateSource = {
  id: "src-epw",
  project_id: PROJECT.id,
  kind: "epw",
  ref: "asset-epw",
  label: "Pittsfield.Muni.AP",
  is_default: false,
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
  is_default: true,
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

function renderTab(project: typeof PROJECT = PROJECT) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider
        value={{
          unitSystem: "SI",
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
  test("routes from location to attached EPW and ASHRAE detail pages", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [EPW_SOURCE, ASHRAE_SOURCE] });
      if (url === SUN_PATH_URL) return jsonResponse(null);
      return jsonResponse({}, 404);
    });
    const user = userEvent.setup();

    renderTab();

    expect(await screen.findByRole("button", { name: /Pittsfield\.Muni\.AP/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Pittsfield ASHRAE/ })).toBeVisible();
    expect(screen.getByText("Sun path")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Pittsfield\.Muni\.AP/ }));
    expect(await screen.findByText("HDD65")).toBeVisible();
    expect(screen.getByText("3884")).toBeVisible();
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
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [EPW_SOURCE, ASHRAE_SOURCE] });
      if (url === SUN_PATH_URL) return jsonResponse(null);
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
    // The editor is a modal, opened from "Set Location".
    expect(screen.queryByLabelText("Latitude")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Set Location/ }));
    expect(await screen.findByLabelText("Latitude")).toBeVisible();
    expect(screen.getByRole("button", { name: /Locate Climate Data/ })).toBeVisible();
  });

  test("a viewer cannot open the dataset picker", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === LOCATION_URL) return jsonResponse(SET_LOCATION);
      if (url === SOURCES_URL) return jsonResponse({ items: [] });
      if (url === SUN_PATH_URL) return jsonResponse(null);
      return jsonResponse({}, 404);
    });

    renderTab({ ...PROJECT, access_mode: "viewer" });

    // The unattached Phius slot is shown, but as a static card — no picker entry.
    expect(await screen.findByText("Phius")).toBeVisible();
    expect(screen.queryByRole("button", { name: /No source attached/ })).toBeNull();
    expect(screen.queryByText("Select Phius climate dataset")).toBeNull();
  });
});
