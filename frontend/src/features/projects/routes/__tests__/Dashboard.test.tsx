import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../../app/query-client";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import type { AuthSession } from "../../../auth/types";
import { jsonResponse } from "../../testing/locationFixtures";
import type { ProjectSummary } from "../../types";
import { Dashboard } from "../Dashboard";

const session: AuthSession = {
  user: {
    id: "owner-ed",
    email: "ed@example.com",
    display_name: "Ed May",
    units_preference: "SI",
  },
  expires_at: "2026-08-02T12:00:00Z",
  capabilities: ["admin.users.manage", "projects.access.all"],
};

function project(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: "project-ed",
    owner_id: "owner-ed",
    owner_display_name: "Ed May",
    name: "Ed project",
    public_alias: null,
    display_name: "Ed project",
    bt_number: "2401",
    client: null,
    cert_programs: [],
    phius_number: null,
    phius_dropbox_url: null,
    active_version_id: null,
    last_saved_at: null,
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

const projects = [
  project({}),
  project({
    id: "project-john",
    owner_id: "owner-john",
    owner_display_name: "John Mitchell",
    name: "John project",
    display_name: "John project",
    bt_number: "2501",
  }),
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      if (url === "/api/v1/projects") return jsonResponse({ projects, grouped: true });
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Dashboard project selection", () => {
  test("select all selects only projects owned by the signed-in user", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <UnitPreferenceContext.Provider
          value={{
            unitSystem: "SI",
            source: "default",
            error: null,
            setUnitSystem: vi.fn(),
            toggleUnitSystem: vi.fn(),
          }}
        >
          <MemoryRouter>
            <Dashboard session={session} />
          </MemoryRouter>
        </UnitPreferenceContext.Provider>
      </QueryClientProvider>,
    );

    const selectAll = await screen.findByRole("checkbox", { name: "Select all projects" });
    await user.click(selectAll);

    expect(screen.getByRole("checkbox", { name: /Select project 2401/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Select project 2501/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Delete selected (1)" })).toBeVisible();
  });
});
