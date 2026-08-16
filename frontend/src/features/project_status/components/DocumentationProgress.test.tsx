import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import type { ProjectDetail } from "../../projects/types";
import { DocumentationProgress } from "./DocumentationProgress";

const PROJECT = {
  id: "proj_1",
  active_version_id: "ver_1",
  access_mode: "editor",
} as ProjectDetail;

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test("renders counts-only section meters and disclosed group links", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(rollupFixture()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  renderProgress();

  // Project totals first, then the section — the same meters, anchored deeper.
  const specMeters = await screen.findAllByRole("link", { name: /Spec. Status 1\/2/ });
  expect(specMeters.map((meter) => meter.getAttribute("href"))).toEqual([
    "/projects/proj_1/documentation?needs=spec",
    "/projects/proj_1/documentation?needs=spec#equipment",
  ]);
  expect(screen.getAllByText("3 of 6 need attention")[0]).toBeVisible();
  // The header opens the section's own tab; the meters open the evidence.
  expect(screen.getByRole("link", { name: "Open Equipment" })).toHaveAttribute(
    "href",
    "/projects/proj_1/equipment",
  );
  await user.click(screen.getByRole("button", { name: "Equipment" }));
  expect(screen.getByRole("link", { name: "Pumps" })).toHaveAttribute(
    "href",
    "/projects/proj_1/documentation#pumps",
  );
  expect(sessionStorage.getItem("phn:overview-documentation-groups:proj_1")).toBe('["equipment"]');
});

test.each([
  ["apertures", "Open Apertures", "/projects/proj_1/apertures"],
  ["envelope", "Open Envelope", "/projects/proj_1/envelope"],
  ["thermal_bridges", "Open Thermal Bridges", "/projects/proj_1/thermal-bridges"],
  // No such tab — fall back to Documentation rather than route to a 404.
  [
    "invented_section",
    "Open in Documentation - Equipment",
    "/projects/proj_1/documentation#equipment",
  ],
])("section %s header opens %s", async (key, label, href) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const fixture = rollupFixture();
      return new Response(
        JSON.stringify({ ...fixture, sections: [{ ...fixture.sections[0], key }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
  renderProgress();

  expect(await screen.findByRole("link", { name: label })).toHaveAttribute("href", href);
});

test("keeps the heading in every state, so nothing jumps when data lands", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await gate;
      return new Response(JSON.stringify(rollupFixture()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  renderProgress();

  // Loading: heading already present, with the skeleton under it.
  expect(screen.getByRole("heading", { name: "Documentation progress" })).toBeVisible();
  release?.();
  expect(await screen.findByRole("button", { name: "Equipment" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Documentation progress" })).toBeVisible();
});

test("a version with no sections gets an empty panel, not a bare heading", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ...rollupFixture(), sections: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
  renderProgress();

  expect(await screen.findByText("Nothing to document yet.")).toBeVisible();
});

test("an axis with nothing tracked reads as untracked, not as complete", async () => {
  const empty = {
    spec_done: 0,
    spec_total: 0,
    ds_done: 0,
    ds_total: 0,
    photo_done: 0,
    photo_total: 0,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...rollupFixture(),
            counts: empty,
            sections: [
              {
                key: "equipment",
                title: "Equipment",
                anchor: "equipment",
                counts: empty,
                groups: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
  renderProgress();

  const meter = await screen.findAllByRole("progressbar", { name: "Spec. Status none tracked" });
  // An empty track, not a full one — and no "N need attention" for zero work.
  expect(meter[0]).toHaveAttribute("aria-valuenow", "0");
  expect(screen.queryByText(/need attention/)).toBeNull();
});

function renderProgress() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DocumentationProgress project={PROJECT} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function rollupFixture() {
  const counts = {
    spec_done: 1,
    spec_total: 2,
    ds_done: 1,
    ds_total: 2,
    photo_done: 1,
    photo_total: 2,
  };
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "version-etag",
    draft_etag: "draft-etag",
    counts,
    sections: [
      {
        key: "equipment",
        title: "Equipment",
        anchor: "equipment",
        counts,
        groups: [{ key: "pumps", title: "Pumps", anchor: "pumps", counts }],
      },
    ],
  };
}
