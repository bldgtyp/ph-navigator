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
  expect(screen.getByRole("link", { name: "Open in Documentation - Equipment" })).toHaveAttribute(
    "href",
    "/projects/proj_1/documentation#equipment",
  );
  await user.click(screen.getByRole("button", { name: "Equipment" }));
  expect(screen.getByRole("link", { name: "Pumps" })).toHaveAttribute(
    "href",
    "/projects/proj_1/documentation#pumps",
  );
  expect(sessionStorage.getItem("phn:overview-documentation-groups:proj_1")).toBe('["equipment"]');
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
