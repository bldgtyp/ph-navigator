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
  items: [{ ...PITTSFIELD, id: "nyc", name: "New York City", station_id: "NYC" }],
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
        projectId={PROJECT_ID}
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

    expect(await screen.findByRole("button", { name: /^New York City/ })).toBeVisible();
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
    expect(await screen.findByText("Select PHI climate dataset")).toBeVisible();
  });
});
