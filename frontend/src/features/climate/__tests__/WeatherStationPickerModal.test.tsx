import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SET_LOCATION,
  UNSET_LOCATION,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import type { ProjectLocation } from "../../projects/types";
import { WeatherStationPickerModal } from "../components/WeatherStationPickerModal";
import type { EpwRosterItem, EpwRosterResponse } from "../types";

const PROJECT_ID = "proj-1";
const LOCATION_URL = `/api/v1/projects/${PROJECT_ID}/location`;
const ROSTER_BASE = `/api/v1/projects/${PROJECT_ID}/climate/epw-roster`;
const FROM_CATALOG_URL = `/api/v1/projects/${PROJECT_ID}/climate/sources/weather/from-catalog`;
const fetchMock = vi.fn();

const PROJECT = { latitude: 42.28, longitude: -73.36, elevation_m: 300, state: "MA" };

const PITTSFIELD: EpwRosterItem = {
  name: "Pittsfield.Muni.AP",
  wmo: "744104",
  region: "MA",
  latitude: 42.43,
  longitude: -73.29,
  elevation_m: 364,
  distance_mi: 8.1,
  elevation_delta_ft: 210,
  source_url: "https://climate.onebuilding.org/pittsfield.zip",
  version_label: "TMYx 2009–2023",
};
const BOSTON: EpwRosterItem = {
  ...PITTSFIELD,
  name: "Boston.Logan",
  wmo: "725090",
  distance_mi: 120.0,
  elevation_delta_ft: -965,
  source_url: "https://climate.onebuilding.org/boston.zip",
  version_label: "TMY3",
};
const ALBANY: EpwRosterItem = {
  ...PITTSFIELD,
  name: "Albany.Intl",
  region: "NY",
  source_url: "https://climate.onebuilding.org/albany.zip",
};

const MA_ROSTER: EpwRosterResponse = { project: PROJECT, items: [PITTSFIELD, BOSTON], total: 2 };
const NY_ROSTER: EpwRosterResponse = { project: PROJECT, items: [ALBANY], total: 1 };

type FetchScenario = {
  location?: ProjectLocation;
  roster?: (params: URLSearchParams) => EpwRosterResponse;
  onPost?: (body: Record<string, unknown>) => void;
};

function installFetch(scenario: FetchScenario): void {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === LOCATION_URL) return jsonResponse(scenario.location ?? SET_LOCATION);
    if (url === FROM_CATALOG_URL && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      scenario.onPost?.(body);
      return jsonResponse({ id: "new", project_id: PROJECT_ID, kind: "weather", ...body });
    }
    if (url.startsWith(ROSTER_BASE)) {
      const params = new URLSearchParams(url.split("?")[1] ?? "");
      return jsonResponse(scenario.roster?.(params) ?? MA_ROSTER);
    }
    return jsonResponse({}, 404);
  });
}

function renderPicker(props: Partial<Parameters<typeof WeatherStationPickerModal>[0]> = {}) {
  const onClose = vi.fn();
  const onRequestSetLocation = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <WeatherStationPickerModal
        projectId={PROJECT_ID}
        onClose={onClose}
        onRequestSetLocation={onRequestSetLocation}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose, onRequestSetLocation };
}

async function chooseState(user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> {
  const stateInput = screen.getByRole("combobox", { name: "State" });
  await user.click(stateInput);
  await user.type(stateInput, label);
  await user.click(await screen.findByRole("option", { name: label }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("WeatherStationPickerModal", () => {
  test("lists catalog stations with distance/elevation and no verdict chip", async () => {
    installFetch({});
    renderPicker();

    expect(await screen.findByText(/OneBuilding TMYx catalog · 2 weather files/)).toBeVisible();
    // The state filter defaults to the project's state.
    expect(screen.getByRole("combobox", { name: "State" })).toHaveValue("Massachusetts");
    // List rows (name first → `^` distinguishes them from the map pins).
    expect(await screen.findByRole("button", { name: /^Pittsfield\.Muni\.AP/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Boston\.Logan/ })).toBeVisible();
    // Each row carries its dataset-version label so files of one station are distinguishable.
    expect(screen.getByText("TMYx 2009–2023")).toBeVisible();
    // No certification verdict chips (D4).
    expect(screen.queryByText("Pass")).toBeNull();
    expect(screen.queryByText("Fail")).toBeNull();
    // Map fallback renders selectable station pins.
    expect(screen.getByRole("button", { name: "Select Pittsfield.Muni.AP" })).toBeVisible();
  });

  test("attaches the selected station via from-catalog and closes", async () => {
    const posted: Record<string, unknown>[] = [];
    installFetch({ onPost: (body) => posted.push(body) });
    const onAttached = vi.fn();
    const { onClose } = renderPicker({ onAttached });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Pittsfield\.Muni\.AP/ }));
    await user.click(screen.getByRole("button", { name: "Attach weather file" }));

    expect(posted).toEqual([{ url: "https://climate.onebuilding.org/pittsfield.zip" }]);
    expect(onAttached).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new", kind: "weather" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test("refetches when the state filter changes", async () => {
    installFetch({ roster: (params) => (params.get("region") === "NY" ? NY_ROSTER : MA_ROSTER) });
    renderPicker();
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /^Pittsfield\.Muni\.AP/ });
    await chooseState(user, "New York");

    expect(await screen.findByRole("button", { name: /^Albany\.Intl/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Pittsfield\.Muni\.AP/ })).toBeNull();
  });

  test("guards when the project has no location", async () => {
    installFetch({ location: UNSET_LOCATION });
    const { onClose, onRequestSetLocation } = renderPicker();
    const user = userEvent.setup();

    expect(await screen.findByText(/Set the project location first/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Set the project location" }));
    expect(onClose).toHaveBeenCalled();
    expect(onRequestSetLocation).toHaveBeenCalled();
  });
});
