import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  SET_LOCATION,
  UNSET_LOCATION,
  jsonResponse,
} from "../../projects/testing/locationFixtures";
import type { ProjectLocation } from "../../projects/types";
import { ClimateDatasetPickerModal } from "../components/ClimateDatasetPickerModal";
import type {
  ClimateDatasetRosterItem,
  ClimateDatasetRosterResponse,
  PhClimateKind,
  ProjectClimateSource,
} from "../types";

const PROJECT_ID = "proj-1";
const LOCATION_URL = `/api/v1/projects/${PROJECT_ID}/location`;
const SOURCES_URL = `/api/v1/projects/${PROJECT_ID}/climate/sources`;
const fetchMock = vi.fn();

const PROJECT = { latitude: 42.28, longitude: -73.36, elevation_m: 300, state: "MA" };

const PITTSFIELD: ClimateDatasetRosterItem = {
  id: "pittsfield",
  name: "Pittsfield",
  region: "MA",
  station_id: "PIT",
  latitude: 42.4,
  longitude: -73.3,
  elevation_m: 300,
  climate_zone: "5A",
  proximity: {
    distance_mi: 8.0,
    elevation_delta_ft: 20,
    status: "pass",
    message: "Within 50 mi and 400 ft.",
  },
};

const ALBANY: ClimateDatasetRosterItem = {
  id: "albany",
  name: "Albany",
  region: "NY",
  station_id: "ALB",
  latitude: 42.7,
  longitude: -73.8,
  elevation_m: 90,
  climate_zone: "5A",
  proximity: {
    distance_mi: 60.0,
    elevation_delta_ft: 700,
    status: "fail",
    message: "No Phius set within 50 mi / 400 ft — custom set required ($75).",
  },
};

const MA_ROSTER: ClimateDatasetRosterResponse = {
  dataset: { id: "ds-phius", provider: "phius", version: "2022", label: "Phius 2022" },
  project: PROJECT,
  items: [PITTSFIELD, ALBANY],
  total: 2,
};

const NY_ROSTER: ClimateDatasetRosterResponse = {
  ...MA_ROSTER,
  items: [{ ...PITTSFIELD, id: "hudson", name: "Hudson", region: "New York", station_id: "HUD" }],
  total: 1,
};

function rosterBase(kind: PhClimateKind): string {
  return `/api/v1/projects/${PROJECT_ID}/climate/datasets/${kind}/locations`;
}

type FetchScenario = {
  location?: ProjectLocation;
  sources?: ProjectClimateSource[];
  roster?: (kind: PhClimateKind, params: URLSearchParams) => ClimateDatasetRosterResponse;
  onPost?: (body: Record<string, unknown>) => void;
};

function installFetch(scenario: FetchScenario): void {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === LOCATION_URL) return jsonResponse(scenario.location ?? SET_LOCATION);
    if (url === SOURCES_URL && (init?.method ?? "GET") === "GET") {
      return jsonResponse({ items: scenario.sources ?? [] });
    }
    if (url === SOURCES_URL && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      scenario.onPost?.(body);
      return jsonResponse({ id: "new", project_id: PROJECT_ID, ...body }, 201);
    }
    if (url.startsWith("/api/v1/climate/datasets/") && url.includes("/locations/")) {
      return jsonResponse({
        id: "hudson",
        dataset_id: "ds-phi",
        name: "Hudson",
        country: "US",
        region: "New York",
        climate_zone: "5A",
        latitude: 42.25,
        longitude: -73.79,
        elevation_m: 50,
        station_id: "HUD",
        record: {},
      });
    }
    for (const kind of ["phius", "phi"] as PhClimateKind[]) {
      if (url.startsWith(rosterBase(kind))) {
        const params = new URLSearchParams(url.split("?")[1] ?? "");
        return jsonResponse(scenario.roster?.(kind, params) ?? MA_ROSTER);
      }
    }
    return jsonResponse({}, 404);
  });
}

function renderPicker(
  kind: PhClimateKind,
  props: Partial<Parameters<typeof ClimateDatasetPickerModal>[0]> = {},
) {
  const onClose = vi.fn();
  const onRequestSetLocation = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ClimateDatasetPickerModal
        project={{ id: PROJECT_ID, access_mode: "editor" }}
        kind={kind}
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

describe("ClimateDatasetPickerModal", () => {
  test("lists a PH dataset's stations nearest-first with proximity chips", async () => {
    installFetch({});
    renderPicker("phius");

    expect(await screen.findByText("Phius 2022 · 2 stations")).toBeVisible();
    // The state filter defaults to the project's state.
    expect(screen.getByRole("combobox", { name: "State" })).toHaveValue("Massachusetts");

    const rows = await screen.findAllByText(/Pittsfield|Albany/);
    expect(rows.map((node) => node.textContent)).toEqual(["Pittsfield", "Albany"]);
    expect(screen.getByText("Pass")).toBeVisible();
    expect(screen.getByText("Fail")).toBeVisible();
    // Map fallback renders selectable station pins (no real tiles).
    expect(screen.getByRole("button", { name: "Select Pittsfield" })).toBeVisible();
  });

  test("attaches the selected station and closes", async () => {
    const posted: Record<string, unknown>[] = [];
    installFetch({ onPost: (body) => posted.push(body) });
    const onAttached = vi.fn();
    const { onClose } = renderPicker("phius", { onAttached });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Pittsfield/ }));
    await user.click(screen.getByRole("button", { name: "Attach" }));

    expect(posted).toEqual([{ kind: "phius", ref: "pittsfield", label: "Pittsfield" }]);
    expect(onAttached).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new", kind: "phius", ref: "pittsfield" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test("warns before attaching a failing Phius station", async () => {
    installFetch({});
    renderPicker("phius");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Albany/ }));
    expect(screen.getByText(/custom climate set is required for certification/)).toBeVisible();
  });

  test("centers the selected station row when picked from the map", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    installFetch({});
    renderPicker("phius");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Select Albany" }));

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" }),
    );
    expect(screen.getByRole("button", { name: /^Albany/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  test("offers to replace when a source of the kind is already attached", async () => {
    installFetch({
      sources: [
        {
          id: "existing",
          project_id: PROJECT_ID,
          kind: "phius",
          ref: "old",
          label: "Old station",
          data: null,
          created_at: "2026-06-14T10:00:00Z",
          updated_at: "2026-06-14T10:00:00Z",
        },
      ],
    });
    renderPicker("phius");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /^Pittsfield/ }));
    expect(screen.getByRole("button", { name: "Replace current dataset" })).toBeVisible();
  });

  test("refetches when the state filter changes", async () => {
    installFetch({
      roster: (_kind, params) => (params.get("region") === "NY" ? NY_ROSTER : MA_ROSTER),
    });
    renderPicker("phius");
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /^Pittsfield/ });
    await chooseState(user, "New York");

    expect(await screen.findByRole("button", { name: /^Hudson/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Pittsfield/ })).toBeNull();
  });

  test("supports the any-state nearest mode", async () => {
    const seen: URLSearchParams[] = [];
    installFetch({
      roster: (_kind, params) => {
        seen.push(params);
        return MA_ROSTER;
      },
    });
    renderPicker("phius");
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /^Pittsfield/ });
    await chooseState(user, "Nearest to project (any state)");

    await vi.waitFor(() => expect(seen.some((params) => params.get("near") === "true")).toBe(true));
  });

  test("defaults the filter to the current dataset state", async () => {
    const seen: URLSearchParams[] = [];
    installFetch({
      sources: [
        {
          id: "existing",
          project_id: PROJECT_ID,
          kind: "phi",
          ref: "hudson",
          label: "Hudson",
          data: { dataset_id: "ds-phi" },
          created_at: "2026-06-14T10:00:00Z",
          updated_at: "2026-06-14T10:00:00Z",
        },
      ],
      roster: (_kind, params) => {
        seen.push(params);
        return params.get("region") === "NY" ? NY_ROSTER : MA_ROSTER;
      },
    });
    renderPicker("phi");

    expect(await screen.findByRole("button", { name: /^Hudson/ })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "State" })).toHaveValue("New York");
    expect(seen.some((params) => params.get("region") === "NY")).toBe(true);
  });

  test("finds the nearest station without attaching until confirmed", async () => {
    const posted: Record<string, unknown>[] = [];
    installFetch({
      onPost: (body) => posted.push(body),
      roster: (_kind, params) => {
        if (params.get("near") === "true") return NY_ROSTER;
        return params.get("region") === "NY" ? NY_ROSTER : MA_ROSTER;
      },
    });
    const { onClose } = renderPicker("phi");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Find Nearest" }));

    expect(await screen.findByRole("button", { name: /^Hudson/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "State" })).toHaveValue("New York");
    expect(posted).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Attach" }));
    expect(posted).toEqual([{ kind: "phi", ref: "hudson", label: "Hudson" }]);
    expect(onClose).toHaveBeenCalled();
  });

  test("guards when the project has no location", async () => {
    installFetch({ location: UNSET_LOCATION });
    const { onClose, onRequestSetLocation } = renderPicker("phius");
    const user = userEvent.setup();

    expect(await screen.findByText(/Set the project location first/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Set the project location" }));
    expect(onClose).toHaveBeenCalled();
    expect(onRequestSetLocation).toHaveBeenCalled();
  });

  test("shows an empty state when the kind has no seeded dataset (PHI)", async () => {
    installFetch({
      roster: () => ({ dataset: null, project: PROJECT, items: [], total: 0 }),
    });
    renderPicker("phi");

    expect(await screen.findByText("No PHI dataset is available yet.")).toBeVisible();
  });

  test("drives both kinds from the same component (PHI header)", async () => {
    installFetch({});
    renderPicker("phi");
    expect(await screen.findByText("Set PHI Climate Data")).toBeVisible();
  });
});
