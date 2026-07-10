import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetail } from "../../projects/types";
import { statusSummaryDestinationPath, type ProjectStatusSummary } from "../summary";
import { RecordStatusSummary } from "./RecordStatusSummary";

const PROJECT: ProjectDetail = {
  id: "proj_1",
  name: "Linde Home",
  bt_number: "2524",
  client: null,
  cert_programs: ["phius"],
  phius_number: null,
  phius_dropbox_url: null,
  active_version_id: "ver_1",
  last_saved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  versions: [],
  active_version: null,
  access_mode: "editor",
  owner_display_name: "Ed May",
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("statusSummaryDestinationPath", () => {
  test("builds focused routes for every destination family", () => {
    expect(
      statusSummaryDestinationPath("proj_1", { kind: "equipment_tab", key: "appliances" }, "app_1"),
    ).toBe("/projects/proj_1/equipment?tab=appliances&focus=app_1");
    expect(
      statusSummaryDestinationPath(
        "proj_1",
        { kind: "heat_pump_leaf", key: "units-indoor" },
        "hpiu_1",
      ),
    ).toBe("/projects/proj_1/equipment/heat-pumps/units-indoor?focus=hpiu_1");
    expect(
      statusSummaryDestinationPath("proj_1", { kind: "thermal_bridges", key: null }, "tb_1"),
    ).toBe("/projects/proj_1/thermal-bridges?focus=tb_1");
    expect(
      statusSummaryDestinationPath("proj_1", { kind: "aperture_glazings", key: null }, "pglz_1"),
    ).toBe("/projects/proj_1/apertures/glazings");
    expect(
      statusSummaryDestinationPath("proj_1", { kind: "aperture_frames", key: null }, "pfrm_1"),
    ).toBe("/projects/proj_1/apertures/frames");
    expect(
      statusSummaryDestinationPath("proj_1", { kind: "envelope_materials", key: null }, "pmat_1"),
    ).toBe("/projects/proj_1/envelope/materials");
  });
});

test("keeps groups collapsed and bounds attention and resolved disclosure", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(summaryFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  renderSummary();

  expect(await screen.findByText("12 needed")).toBeInTheDocument();
  const pumpsToggle = screen.getByRole("button", { name: /Pumps/ });
  expect(pumpsToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Pump 1")).toBeNull();

  await user.click(pumpsToggle);
  const pumpsLeafToggle = screen.getByRole("button", {
    name: "Pumps 12 need attention 1 resolved",
  });
  expect(pumpsLeafToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Pump 1")).toBeNull();

  await user.click(pumpsLeafToggle);
  const records = screen.getByText("Pump 1").closest<HTMLElement>(".record-status-leaf");
  expect(records).not.toBeNull();
  expect(within(records!).getAllByRole("article")).toHaveLength(10);
  expect(within(records!).queryByText("Pump 12")).toBeNull();
  expect(within(records!).queryByText("Resolved pump")).toBeNull();

  await user.click(within(records!).getByRole("button", { name: "Show all 12 attention items" }));
  expect(within(records!).getAllByRole("article")).toHaveLength(12);
  await user.click(within(records!).getByRole("button", { name: "Show 1 resolved" }));
  expect(within(records!).getByText("Resolved pump")).toBeInTheDocument();
});

test("recovers from a section-scoped load error through Retry", async () => {
  const user = userEvent.setup();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify(summaryFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  renderSummary();

  await user.click(await screen.findByRole("button", { name: "Retry" }));

  const region = screen.getByRole("region", { name: "Record status" });
  expect(await within(region).findByText("12 needed")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("keeps nested subgroup tables collapsed until each tree level opens", async () => {
  const user = userEvent.setup();
  const fixture = summaryFixture();
  fixture.groups = [
    {
      key: "mechanical",
      label: "Mechanical",
      counts: { needed: 0, question: 0, complete: 0, na: 0, unknown: 0 },
      leaves: [
        {
          table_name: "heat_pumps_outdoor_equip",
          label: "Outdoor Equipment",
          subgroup_key: "heat_pumps",
          subgroup_label: "Heat Pumps",
          destination: { kind: "heat_pump_leaf", key: "equipment-outdoor" },
          counts: { needed: 0, question: 0, complete: 0, na: 0, unknown: 0 },
          records: [],
        },
      ],
    },
  ];
  fixture.counts = { needed: 0, question: 0, complete: 0, na: 0, unknown: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  renderSummary();

  await user.click(await screen.findByRole("button", { name: "Mechanical No records" }));
  expect(screen.getByRole("button", { name: "Heat Pumps No records" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(screen.queryByRole("button", { name: "Outdoor Equipment No records" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Heat Pumps No records" }));
  const outdoor = screen.getByRole("button", { name: "Outdoor Equipment No records" });
  expect(outdoor).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("link", { name: "Open table" })).toHaveAttribute(
    "href",
    "/projects/proj_1/equipment/heat-pumps/equipment-outdoor",
  );

  await user.click(outdoor);
  expect(screen.getByText("No records.")).toBeVisible();
});

function renderSummary() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecordStatusSummary project={PROJECT} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function summaryFixture(): ProjectStatusSummary {
  const attention = Array.from({ length: 12 }, (_, index) => ({
    id: `pmp_${index + 1}`,
    display_name: `Pump ${index + 1}`,
    status: "needed" as const,
    notes: index === 0 ? "Confirm control sequence." : null,
  }));
  return {
    project_id: PROJECT.id,
    version_id: "ver_1",
    source: "draft",
    version_etag: "etag",
    draft_etag: "draft-etag",
    counts: { needed: 12, question: 0, complete: 1, na: 0, unknown: 0 },
    groups: [
      {
        key: "pumps",
        label: "Pumps",
        counts: { needed: 12, question: 0, complete: 1, na: 0, unknown: 0 },
        leaves: [
          {
            table_name: "pumps",
            label: "Pumps",
            destination: { kind: "equipment_tab", key: "pumps" },
            counts: { needed: 12, question: 0, complete: 1, na: 0, unknown: 0 },
            records: [
              ...attention,
              { id: "pmp_99", display_name: "Resolved pump", status: "complete", notes: null },
            ],
          },
        ],
      },
    ],
  };
}
