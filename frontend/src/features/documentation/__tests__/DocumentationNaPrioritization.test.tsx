import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetail } from "../../projects/types";
import type { ProjectDocumentationSummary } from "../types";
import { DocumentationPage } from "../routes/DocumentationPage";
import {
  PROJECT,
  assetUrlsFixture,
  envelopeNaSummaryFixture,
} from "./DocumentationSummaryView.fixtures";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Documentation Assembly N/A prioritization", () => {
  test("groups fully N/A records last for an editor and retains disclosure state", async () => {
    const user = userEvent.setup();
    renderDocumentation(envelopeNaSummaryFixture(), PROJECT);

    await user.click(await screen.findByRole("button", { name: "Exterior wall" }));
    expect(screen.getAllByRole("progressbar", { name: "Spec. Status 3/4" })).toHaveLength(3);
    expect(screen.getByText("Actionable insulation")).toBeVisible();
    expect(screen.getByText("Partial N/A membrane")).toBeVisible();
    const notApplicable = screen.getByRole("button", { name: "Not applicable (2)" });
    expect(notApplicable).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("N/A air gap")).not.toBeInTheDocument();

    await user.click(notApplicable);
    expect(screen.getAllByRole("progressbar", { name: "Spec. Status 3/4" })).toHaveLength(3);
    expect(screen.getByText("N/A air gap")).toBeVisible();
    expect(screen.getByText("N/A finish layer")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Exterior wall" }));
    await user.click(screen.getByRole("button", { name: "Exterior wall" }));
    expect(screen.getByText("N/A air gap")).toBeVisible();
  });

  test.each([
    ["locked editor", { ...PROJECT, active_version: { ...PROJECT.active_version!, locked: true } }],
    ["authenticated read-only user", { ...PROJECT, access_mode: "viewer" as const }],
  ])("retains the N/A section for a %s", async (_label, project) => {
    const user = userEvent.setup();
    renderDocumentation(envelopeNaSummaryFixture(), project);

    await user.click(await screen.findByRole("button", { name: "Exterior wall" }));
    expect(screen.getByRole("button", { name: "Not applicable (2)" })).toBeVisible();
  });

  test("hides fully N/A rows and N/A-only groups from anonymous users", async () => {
    const user = userEvent.setup();
    renderDocumentation(envelopeNaSummaryFixture(), { ...PROJECT, access_mode: "viewer" }, false);

    await user.click(await screen.findByRole("button", { name: "Exterior wall" }));
    expect(screen.getByText("Actionable insulation")).toBeVisible();
    expect(screen.queryByText("N/A air gap")).not.toBeInTheDocument();
    expect(screen.queryByText("N/A finish layer")).not.toBeInTheDocument();
    expect(screen.queryByText("N/A-only hidden layer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Not applicable/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "N/A-only assembly" })).not.toBeInTheDocument();
  });

  test("omits an anonymous Envelope section when every Assembly record is fully N/A", async () => {
    renderDocumentation(
      envelopeNaSummaryFixture({ onlyFullyNa: true }),
      { ...PROJECT, access_mode: "viewer" },
      false,
      "/projects/proj_1/documentation",
    );

    expect(await screen.findByRole("heading", { name: "Documentation status" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Envelope" })).not.toBeInTheDocument();
    expect(screen.queryByText("N/A air gap")).not.toBeInTheDocument();
  });

  test("attention filters omit the N/A section but retain a raw-axis Needed record", async () => {
    const user = userEvent.setup();
    renderDocumentation(
      envelopeNaSummaryFixture(),
      PROJECT,
      true,
      "/projects/proj_1/documentation?needs=datasheet#envelope",
    );

    await user.click(await screen.findByRole("button", { name: "Exterior wall" }));
    expect(screen.getByText("Actionable insulation")).toBeVisible();
    expect(screen.getByText("Partial N/A membrane")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Not applicable/ })).not.toBeInTheDocument();
  });
});

function renderDocumentation(
  summary: ProjectDocumentationSummary,
  project: ProjectDetail,
  authenticated = true,
  initialEntry = "/projects/proj_1/documentation#envelope",
) {
  stubFetch(summary, project.access_mode === "viewer");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/projects/:projectId/documentation"
            element={
              <DocumentationPage
                project={project}
                audiencePolicy={authenticated ? "authenticated" : "anonymous-hidden"}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(summary: ProjectDocumentationSummary, useSavedDocument: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url.endsWith(
          useSavedDocument ? "/document/documentation-summary" : "/draft/documentation-summary",
        )
      ) {
        return Promise.resolve(jsonResponse(summary));
      }
      if (url.startsWith("/api/v1/projects/proj_1/assets/bulk-urls")) {
        return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
