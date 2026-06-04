// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./app/App";
import {
  buildRoom,
  roomsBuiltInFieldDefs,
  withRoomCustomValues,
} from "./features/equipment/testing/testFixtures";

const fetchMock = vi.fn();

const userPayload = {
  id: "d39f5a2c-4c08-4085-81ab-c38d9ca30566",
  email: "ed@example.com",
  display_name: "Ed May",
};

const projectPayload = {
  id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
  name: "West Stockbridge House",
  bt_number: "2426",
  client: "May",
  cert_programs: ["phi"],
  phius_number: null,
  phius_dropbox_url: null,
  owner_display_name: "Ed May",
  active_version_id: "61561caa-44d0-401d-9daa-0fa113df8340",
  last_saved_at: "2026-05-12T18:00:00Z",
  created_at: "2026-05-12T18:00:00Z",
  updated_at: "2026-05-12T18:00:00Z",
  access_mode: "editor",
  active_version: {
    id: "61561caa-44d0-401d-9daa-0fa113df8340",
    project_id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 1,
    body_size_bytes: 230,
    created_at: "2026-05-12T18:00:00Z",
    updated_at: "2026-05-12T18:00:00Z",
  },
  versions: [
    {
      id: "61561caa-44d0-401d-9daa-0fa113df8340",
      project_id: "5b99d1c9-d1f6-46c8-a9aa-9f7efb8c54b5",
      name: "Working",
      kind: "working",
      locked: false,
      schema_version: 1,
      body_size_bytes: 230,
      created_at: "2026-05-12T18:00:00Z",
      updated_at: "2026-05-12T18:00:00Z",
    },
  ],
};

const projectDeleteCounts = {
  versions: 1,
  drafts: 0,
  status_items: 0,
  assets: 0,
  jobs: 0,
  mcp_tokens: 0,
  table_views: 0,
};

const deletedProjectPayload = {
  ...projectPayload,
  deleted_at: "2026-05-26T20:00:00Z",
  deleted_by: userPayload.id,
  hard_delete_after: "2026-08-24T20:00:00Z",
  counts: projectDeleteCounts,
};

const alternateVersion = {
  id: "9e07b34a-819d-4b65-bda4-d7fc43997f93",
  project_id: projectPayload.id,
  name: "Round 1 Submit",
  kind: "submitted",
  locked: true,
  schema_version: 1,
  body_size_bytes: 230,
  created_at: "2026-05-12T19:00:00Z",
  updated_at: "2026-05-12T19:00:00Z",
};

const statusItemPayload = {
  id: "e402f85e-ce78-41f2-a16f-685ff42edfc2",
  project_id: projectPayload.id,
  order_index: 1,
  title: "CAD files received",
  state: "todo",
  completion_date: null,
  description: null,
  created_at: "2026-05-12T18:00:00Z",
  created_by: userPayload.id,
  updated_at: "2026-05-12T18:00:00Z",
  updated_by: userPayload.id,
};

const roomsSlicePayload = {
  project_id: projectPayload.id,
  version_id: projectPayload.active_version_id,
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  rooms: [],
  field_defs: roomsBuiltInFieldDefs,
  single_select_options: {
    "rooms.floor_level": [],
    "rooms.building_zone": [],
  },
};

const windowTypesSlicePayload = {
  project_id: projectPayload.id,
  version_id: projectPayload.active_version_id,
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  window_types: [
    {
      id: "win_1",
      name: "Test Window Type",
      row_heights_mm: [1000],
      column_widths_mm: [1000],
      elements: [
        {
          id: "winel_1",
          row_span: [0, 0],
          column_span: [0, 0],
          frames: {
            top: {
              name: "Old frame",
              manufacturer: "Skyline",
              brand: "SR",
              width_mm: 80,
              u_value_w_m2k: 0.85,
              psi_g_w_mk: 0.04,
              psi_install_w_mk: 0.05,
              color: null,
              notes: null,
              source_provenance: null,
              catalog_origin: {
                catalog_table: "frame_types",
                catalog_record_id: "rec1234567890ab",
                catalog_version_id: "framev_old",
                catalog_schema_version: 1,
                synced_at: "2026-05-14T00:00:00Z",
                local_overrides: ["u_value_w_m2k"],
              },
            },
            right: null,
            bottom: null,
            left: null,
          },
          glazing: null,
        },
      ],
    },
  ],
};

const windowTypesRefreshPayload = {
  project_id: projectPayload.id,
  version_id: projectPayload.active_version_id,
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  slots: [
    {
      window_type_id: "win_1",
      element_id: "winel_1",
      slot: "frame.top",
      state: "drifted",
      catalog_table: "frame_types",
      catalog_record_id: "rec1234567890ab",
      pinned_catalog_version_id: "framev_old",
      current_catalog_version_id: "framev_new",
      local_overrides: ["u_value_w_m2k"],
      fields: [
        {
          key: "name",
          ref_value: "Old frame",
          catalog_value: "New frame",
          is_overridden: false,
        },
        {
          key: "u_value_w_m2k",
          ref_value: 0.85,
          catalog_value: 0.95,
          is_overridden: true,
        },
      ],
    },
  ],
};

const draftSummaryPayload = {
  project_id: projectPayload.id,
  version_id: projectPayload.active_version_id,
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  dirty_tables: [],
  last_patched_at: null,
  is_locked: false,
  can_edit: true,
};

const readSafePayload = {
  project_id: projectPayload.id,
  version_id: projectPayload.active_version_id,
  source: "version",
  schema_version: 999,
  current_schema_version: 1,
  schema_version_unsupported: true,
  error_code: "schema_validation_failed_after_migration",
  message:
    "This version uses an older project format that PHN could not fully migrate. Editing is disabled, but the raw project JSON is still available.",
  request_id: "schema-safe",
  validation_errors: ["Input should be 1"],
  body: { schema_version: 999 },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  });
}

function sessionResponse() {
  return jsonResponse({
    user: userPayload,
    expires_at: "2026-05-12T18:00:00Z",
  });
}

function apiErrorResponse(status: number, errorCode: string, message: string) {
  return jsonResponse(
    {
      error_code: errorCode,
      message,
      request_id: "test",
      details: {},
    },
    status,
  );
}

function draftSummaryUrl(
  projectId = projectPayload.id,
  versionId = projectPayload.active_version_id,
) {
  return `/api/v1/projects/${projectId}/versions/${versionId}/draft`;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("App", () => {
  test("redirects unauthenticated root visits to sign-in with a next parameter", async () => {
    window.history.pushState({}, "", "/");
    fetchMock.mockImplementationOnce(() =>
      apiErrorResponse(401, "not_authenticated", "Sign-in required."),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(window.location.pathname).toBe("/sign-in");
    expect(window.location.search).toBe("?next=%2F");
  });

  test("does not redirect session server errors to sign-in", async () => {
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementationOnce(() =>
      apiErrorResponse(500, "server_error", "Session service unavailable."),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Session service unavailable. (Request ID: test)",
      }),
    ).toBeVisible();
    expect(screen.getByText("Session check failed")).toBeVisible();
    expect(window.location.pathname).toBe("/dashboard");
  });

  test("redirects authenticated root visits to dashboard", async () => {
    window.history.pushState({}, "", "/");
    fetchMock
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(() => jsonResponse({ projects: [] }))
      .mockImplementationOnce(() => jsonResponse({ projects: [] }));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Add New Project +" })).toBeVisible();
    expect(window.location.pathname).toBe("/dashboard");
  });

  test("signs in and renders the empty dashboard shell", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/sign-in?next=%2Fdashboard");
    fetchMock
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(() => jsonResponse({ projects: [] }))
      .mockImplementationOnce(() => jsonResponse({ projects: [] }));

    render(<App />);

    await user.type(screen.getByLabelText("Email"), "ed@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("button", { name: "Add New Project +" })).toBeVisible();
    expect(await screen.findByText("No projects yet")).toBeVisible();
    expect(screen.getByLabelText("Account: Ed May")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  test("creates a project and opens its Status tab", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const draftUrl = draftSummaryUrl();
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") {
        const calls = fetchMock.mock.calls.filter(([path]) => String(path) === "/api/v1/projects");
        return calls.length === 1
          ? jsonResponse({ projects: [] })
          : jsonResponse(projectPayload, 201);
      }
      if (url.startsWith("/api/v1/projects/check-bt-number")) {
        return jsonResponse({ available: true, conflict: null });
      }
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return jsonResponse(projectPayload);
      }
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Add New Project +" }));
    await user.type(screen.getByLabelText("Project name"), "West Stockbridge House");
    await user.type(screen.getByLabelText("BT number"), "2426");
    await user.type(screen.getByLabelText("Client"), "May");
    await user.click(screen.getByLabelText("PHI"));
    expect(await screen.findByText("BT number available")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      await screen.findByRole("button", { name: "Version actions for Working" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2426 - West Stockbridge House" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Status" })).toBeVisible();
    const projectTabs = screen.getByRole("navigation", { name: "Project tabs" });
    expect(within(projectTabs).getByRole("link", { name: "Rooms" })).toBeVisible();
    expect(within(projectTabs).getByRole("link", { name: "Thermal Bridges" })).toBeVisible();
    expect(window.location.pathname).toBe(`/projects/${projectPayload.id}/status`);
  });

  test("bulk soft-deletes selected dashboard projects and restores from Recently Deleted", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    let activeProjects = [projectPayload];
    let deletedProjects: unknown[] = [];
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: activeProjects });
      if (url === "/api/v1/projects/deleted") {
        return jsonResponse({ projects: deletedProjects });
      }
      if (url === "/api/v1/projects:bulk-delete" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          project_ids: [projectPayload.id],
          confirm: true,
        });
        activeProjects = [];
        deletedProjects = [deletedProjectPayload];
        return jsonResponse({
          mode: "soft",
          items: [
            {
              project_id: projectPayload.id,
              ok: true,
              deleted_at: deletedProjectPayload.deleted_at,
              hard_delete_after: deletedProjectPayload.hard_delete_after,
              already_deleted: false,
              counts: projectDeleteCounts,
              error_code: null,
              message: null,
            },
          ],
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}:restore` && init?.method === "POST") {
        activeProjects = [projectPayload];
        deletedProjects = [];
        return jsonResponse(projectPayload);
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(
      await screen.findByRole("link", { name: "2426 - West Stockbridge House" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Delete selected/ })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Select project 2426 West Stockbridge House"));
    expect(window.location.pathname).toBe("/dashboard");
    expect(screen.getByRole("button", { name: "Delete selected (1)" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Delete selected (1)" }));
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeVisible();
    expect(screen.getByText("Can be restored for 90 days.")).toBeVisible();
    expect(
      within(screen.getByRole("list", { name: "Selected projects" })).getByText("2426"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete project" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "2426 - West Stockbridge House" }),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("button", { name: "Show list" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show list" }));
    expect(await screen.findByRole("button", { name: "Restore" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Hard delete|Permanently delete/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(
      await screen.findByRole("link", { name: "2426 - West Stockbridge House" }),
    ).toBeVisible();
    expect(await screen.findByText("No deleted projects.")).toBeVisible();
  });

  test("renders a deleted project URL as gone", async () => {
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return apiErrorResponse(410, "project_deleted", "Project deleted.");
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByText("Project deleted")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "This project is deleted and no longer available from this URL.",
      }),
    ).toBeVisible();
  });

  test("renders a public project shell with edit controls hidden", async () => {
    window.history.pushState(
      {},
      "",
      `/projects/${projectPayload.id}/status?version=${projectPayload.active_version_id}#viewer`,
    );
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return jsonResponse({
          ...projectPayload,
          access_mode: "viewer",
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByText("Read-only")).toBeVisible();
    expect(screen.getByText("Edit controls hidden")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Project settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent(
        `/projects/${projectPayload.id}/status?version=${projectPayload.active_version_id}#viewer`,
      )}`,
    );
    expect(await screen.findByText("CAD files received")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Set CAD files received/ }),
    ).not.toBeInTheDocument();
  });

  test("renders table-neutral editor header states", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await screen.findByRole("button", { name: "Version actions for Working" });
    expect(screen.queryByText("Clean")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Account: Ed May")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Rooms JSON" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Version actions for Working" }));
    await user.click(screen.getByRole("menuitem", { name: "Open version..." }));
    expect(screen.getByText("Versions")).toBeVisible();
    await user.click(screen.getByRole("heading", { name: "Status" }));
    expect(screen.queryByText("Versions")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Version actions for Working" }));
    expect(screen.getByRole("menuitem", { name: "Save Version" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Diff" })).toBeVisible();
    await user.click(screen.getByRole("heading", { name: "Status" }));
    expect(screen.queryByRole("menuitem", { name: "Diff" })).not.toBeInTheDocument();
  });

  test("edits project settings and manages MCP tokens", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    const tokenRecord = {
      id: "4d21615a-2ed4-4d5a-bdb2-2995b91e2fe2",
      project_id: projectPayload.id,
      label: "Local Claude",
      token_prefix: "phn_mcp_old",
      scopes: ["project:read"],
      created_at: "2026-05-12T18:00:00Z",
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
    };
    const issuedToken = {
      id: "6c3d4a0f-2e73-4d91-bb3e-90a13a7aca1c",
      project_id: projectPayload.id,
      label: "Desktop MCP",
      token_prefix: "phn_mcp_new",
      scopes: ["project:read", "project:write", "asset:read", "asset:write"],
      created_at: "2026-05-12T19:00:00Z",
      last_used_at: null,
      expires_at: null,
      revoked_at: null,
    };
    const updatedProject = {
      ...projectPayload,
      name: "West Stockbridge Retrofit",
      client: "May Studio",
    };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}` && init?.method === "PATCH") {
        return jsonResponse(updatedProject);
      }
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/mcp-tokens` && init?.method === "POST") {
        return jsonResponse(
          {
            token: "phn_mcp_new_secret",
            token_record: issuedToken,
          },
          201,
        );
      }
      if (url === `/api/v1/projects/${projectPayload.id}/mcp-tokens`) {
        return jsonResponse({ tokens: [tokenRecord] });
      }
      if (
        url === `/api/v1/projects/${projectPayload.id}/mcp-tokens/${tokenRecord.id}/revoke` &&
        init?.method === "POST"
      ) {
        return jsonResponse({ ...tokenRecord, revoked_at: "2026-05-12T20:00:00Z" });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Version actions for Working" }));
    await user.click(screen.getByRole("menuitem", { name: "Project settings" }));
    expect(await screen.findByRole("heading", { name: "Project settings" })).toBeVisible();
    expect(await screen.findByText("Local Claude")).toBeVisible();
    await user.clear(screen.getByLabelText("Project name"));
    await user.type(screen.getByLabelText("Project name"), "West Stockbridge Retrofit");
    await user.clear(screen.getByLabelText("Client"));
    await user.type(screen.getByLabelText("Client"), "May Studio");
    await user.type(screen.getByLabelText("Token label"), "Desktop MCP");
    await user.click(screen.getByRole("button", { name: "Create token" }));

    expect(await screen.findByText("phn_mcp_new_secret")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("phn_mcp_new_secret");
    expect(await screen.findByText("Copied.")).toBeVisible();
    const existingTokenRow = screen.getByText("Local Claude").closest(".token-row");
    if (!existingTokenRow) throw new Error("Expected existing-token row.");
    await user.click(
      within(existingTokenRow as HTMLElement).getByRole("button", { name: "Revoke" }),
    );
    expect(await screen.findByText("1 revoked token")).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog", { name: "Project settings" })).getByRole("button", {
        name: "Save",
      }),
    );

    expect(
      await screen.findByRole("link", { name: "2426 - West Stockbridge Retrofit" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/projects/${projectPayload.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "West Stockbridge Retrofit", client: "May Studio" }),
      }),
    );
  });

  test("renders locked editor header as Save As only", async () => {
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    const lockedProject = {
      ...projectPayload,
      active_version: { ...projectPayload.active_version, locked: true },
      versions: [{ ...projectPayload.versions[0], locked: true }],
    };
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(lockedProject);
      if (url === draftUrl) {
        return jsonResponse({
          ...draftSummaryPayload,
          source: "draft",
          draft_etag: "draft-etag",
          dirty_tables: ["rooms"],
          is_locked: true,
          can_edit: false,
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Version actions for Working · Locked" }),
    ).toBeVisible();
    expect(await screen.findByText("Uncommitted changes")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save As" })).toBeVisible();
  });

  test("prompts to restore or discard a recovered draft and warns before unload", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl && init?.method === "DELETE") return jsonResponse(undefined, 204);
      if (url === draftUrl) {
        return jsonResponse({
          ...draftSummaryPayload,
          source: "draft",
          draft_etag: "draft-etag",
          dirty_tables: ["rooms"],
          last_patched_at: "2026-05-12T18:05:00Z",
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByRole("dialog", { name: "Recovered draft found" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(screen.queryByRole("dialog", { name: "Recovered draft found" })).not.toBeInTheDocument();

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "Version actions for Working" }));
    await user.click(screen.getByRole("menuitem", { name: "Discard changes" }));
    await user.click(screen.getByRole("button", { name: "Discard draft" }));

    expect(fetchMock).toHaveBeenCalledWith(draftUrl, expect.objectContaining({ method: "DELETE" }));
  });

  test("requires a save, save-as, or discard choice before switching away from a dirty version", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    const saveUrl = `${draftUrl}/save`;
    const projectWithVersions = {
      ...projectPayload,
      versions: [projectPayload.versions[0], alternateVersion],
    };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectWithVersions);
      if (url === draftUrl) {
        return jsonResponse({
          ...draftSummaryPayload,
          source: "draft",
          draft_etag: "draft-etag",
          dirty_tables: ["rooms"],
        });
      }
      if (url === saveUrl && init?.method === "POST") {
        return jsonResponse({
          project_id: projectPayload.id,
          version: projectPayload.active_version,
          version_etag: "saved-etag",
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Restore draft" }));
    await user.click(screen.getByRole("button", { name: "Version actions for Working" }));
    await user.click(screen.getByRole("menuitem", { name: "Open version..." }));
    await user.click(
      within(screen.getByText("Round 1 Submit").closest(".version-row") as HTMLElement).getByRole(
        "button",
        { name: "Open" },
      ),
    );

    expect(await screen.findByRole("dialog", { name: "Uncommitted draft" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save then open" }));

    expect(fetchMock).toHaveBeenCalledWith(
      saveUrl,
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Object),
      }),
    );
    expect(window.location.search).toBe(`?version=${alternateVersion.id}`);
  });

  test("shows Save As and discard exits when Save finds a stale version ETag", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    const saveUrl = `${draftUrl}/save`;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) {
        return jsonResponse({
          ...draftSummaryPayload,
          source: "draft",
          draft_etag: "draft-etag",
          dirty_tables: ["rooms"],
        });
      }
      if (url === saveUrl && init?.method === "POST") {
        return apiErrorResponse(409, "version_etag_mismatch", "Version changed.");
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Restore draft" }));
    await user.click(screen.getByRole("button", { name: "Save Version" }));

    const dialog = await screen.findByRole("dialog", { name: "Saved version changed" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Save As" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Discard draft" })).toBeVisible();
  });

  test("renders read-safe recovery when the editor draft summary is unsupported", async () => {
    window.history.pushState({}, "", `/projects/${projectPayload.id}/rooms`);
    const draftUrl = draftSummaryUrl();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return jsonResponse({
          ...projectPayload,
          active_version: { ...projectPayload.active_version, schema_version: 999 },
          versions: [{ ...projectPayload.versions[0], schema_version: 999 }],
        });
      }
      if (url === draftUrl) return jsonResponse(readSafePayload);
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Project format recovery" })).toBeVisible();
    expect(screen.getByText(/Editing is disabled/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Download raw project JSON" })).toHaveAttribute(
      "href",
      `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/download`,
    );
    expect(screen.getByText("schema-safe")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Rooms" })).not.toBeInTheDocument();
  });

  test("renders public read-safe recovery without editor diagnostics", async () => {
    window.history.pushState(
      {},
      "",
      `/projects/${projectPayload.id}/rooms?version=${projectPayload.active_version_id}#viewer`,
    );
    const documentUrl = `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/document`;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return jsonResponse({
          ...projectPayload,
          access_mode: "viewer",
          active_version: { ...projectPayload.active_version, schema_version: 999 },
          versions: [{ ...projectPayload.versions[0], schema_version: 999 }],
        });
      }
      if (url === documentUrl) return jsonResponse(readSafePayload);
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Project format recovery" })).toBeVisible();
    expect(screen.getByText("Read-only")).toBeVisible();
    expect(screen.getByRole("link", { name: "Download raw project JSON" })).toBeVisible();
    expect(screen.queryByText("Saved schema")).not.toBeInTheDocument();
    expect(screen.queryByText("schema-safe")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Version" })).not.toBeInTheDocument();
  });

  test("refetches project access after signing in from a public project URL", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    let projectFetchCount = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const draftUrl = draftSummaryUrl();
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        projectFetchCount += 1;
        return jsonResponse({
          ...projectPayload,
          access_mode: projectFetchCount === 1 ? "viewer" : "editor",
        });
      }
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === "/api/v1/auth/login") return sessionResponse();
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByText("Read-only")).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Sign in" }));
    await user.type(await screen.findByLabelText("Email"), "ed@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(projectFetchCount).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole("link", { name: "2426 - West Stockbridge House" })).toBeVisible();
    expect(screen.queryByText("Editor")).not.toBeInTheDocument();
    expect(screen.queryByText("Read-only public view")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Set CAD files received to Done/ }),
    ).toBeVisible();
  });

  test("routes the Materials dashboard card to the live Materials catalog page", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: [] });
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      if (url.startsWith("/api/v1/catalogs/materials")) return jsonResponse({ items: [] });
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("link", { name: "Materials" }));

    expect(await screen.findByRole("button", { name: "New Material +" })).toBeVisible();
    expect(await screen.findByText("No materials yet. Shift-Enter to add one.")).toBeVisible();
    expect(window.location.pathname).toBe("/catalog/materials");
  });

  test("closes the topbar account menu when clicking outside", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: [] });
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByLabelText("Account: Ed May"));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    await user.click(screen.getByRole("heading", { name: "No projects yet" }));
    expect(screen.getByRole("button", { name: "Sign out", hidden: true })).not.toBeVisible();
  });

  test("routes the Window-Frame Elements dashboard card to its catalog page", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: [] });
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      if (url.startsWith("/api/v1/catalogs/frame-types")) return jsonResponse({ items: [] });
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("link", { name: "Window-Frame Elements" }));

    expect(await screen.findByRole("heading", { name: "Window-Frame Elements" })).toBeVisible();
    expect(await screen.findByText("No frame types yet")).toBeVisible();
    expect(window.location.pathname).toBe("/catalog/frame-types");
  });

  test("routes the Window-Glazing dashboard card to its catalog page", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: [] });
      if (url === "/api/v1/projects/deleted") return jsonResponse({ projects: [] });
      if (url.startsWith("/api/v1/catalogs/glazing-types")) return jsonResponse({ items: [] });
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("link", { name: "Window-Glazing" }));

    expect(await screen.findByRole("heading", { name: "Window-Glazing" })).toBeVisible();
    expect(await screen.findByText("No glazing types yet")).toBeVisible();
    expect(window.location.pathname).toBe("/catalog/glazing-types");
  });

  test("applies the default status template from the empty Status tab", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const draftUrl = draftSummaryUrl();
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === `/api/v1/projects/${projectPayload.id}/status-items` && !init?.method) {
        return jsonResponse({ items: [] });
      }
      if (
        url === `/api/v1/projects/${projectPayload.id}/status-items/apply-default-template` &&
        init?.method === "POST"
      ) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Apply BLDGTYP default template" }));

    expect(await screen.findByText("CAD files received")).toBeVisible();
    expect(screen.getByRole("button", { name: /Set CAD files received to Done/ })).toBeVisible();
  });

  test("adds a room through the Rooms page draft path", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/rooms`);
    const roomsUrl = `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/draft/tables/rooms`;
    const draftUrl = draftSummaryUrl();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) {
        const roomWriteCount = fetchMock.mock.calls.filter(
          ([path, options]) => String(path) === roomsUrl && options?.method === "PUT",
        ).length;
        return jsonResponse(
          roomWriteCount > 0
            ? {
                ...draftSummaryPayload,
                source: "draft",
                draft_etag: "draft-etag",
                dirty_tables: ["rooms"],
                last_patched_at: "2026-05-12T18:05:00Z",
              }
            : draftSummaryPayload,
        );
      }
      if (url === roomsUrl && init?.method !== "PUT") {
        return jsonResponse(roomsSlicePayload);
      }
      if (url === roomsUrl && init?.method === "PUT") {
        const saved = JSON.parse(String(init.body));
        return jsonResponse({
          ...roomsSlicePayload,
          source: "draft",
          draft_etag: "draft-etag",
          rooms: saved.rooms,
          field_defs: saved.field_defs ?? roomsSlicePayload.field_defs,
          single_select_options: saved.single_select_options,
        });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByRole("region", { name: "Rooms" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "More view actions" }));
    expect(screen.getByRole("link", { name: "Rooms JSON" })).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(await screen.findByRole("button", { name: "Add New Room" }));
    await user.type(screen.getByLabelText("Number"), "101");
    await user.type(screen.getByLabelText("Name"), "Living Room");
    await user.type(screen.getByLabelText("Floor level"), "Ground");
    await user.type(screen.getByLabelText("Building zone"), "Residential");
    await user.click(screen.getByRole("button", { name: "Save room" }));

    expect(await screen.findByText("Uncommitted changes")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Version actions for Working" }));
    expect(screen.getByRole("menuitem", { name: "Save Version" })).toBeEnabled();
    expect(screen.getByText("Living Room")).toBeVisible();
    expect(screen.getByText("Ground")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      roomsUrl,
      expect.objectContaining({
        method: "PUT",
        headers: expect.any(Headers),
      }),
    );
  });

  test("downgrades an open room edit when the version is locked elsewhere", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/rooms`);
    const roomsUrl = `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/draft/tables/rooms`;
    const draftUrl = draftSummaryUrl();
    const room = withRoomCustomValues(
      buildRoom({
        id: "rm_101",
        floor_level: "opt_ground",
        building_zone: null,
      }),
      { number: "101", name: "Living Room" },
    );
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) {
        return jsonResponse(projectPayload);
      }
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === roomsUrl && init?.method !== "PUT") {
        return jsonResponse({
          ...roomsSlicePayload,
          source: "draft",
          draft_etag: "draft-etag",
          rooms: [room],
          single_select_options: {
            "rooms.floor_level": [
              { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
            ],
            "rooms.building_zone": [],
          },
        });
      }
      if (url === roomsUrl && init?.method === "PUT") {
        return apiErrorResponse(409, "version_locked", "Version is locked.");
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByText("Living Room")).toBeVisible();
    // Plan 04 changed Enter to open the inline editor on editable
    // cells; the row dialog now opens via the AirTable-style Expand
    // affordance in the row gutter.
    await user.click(screen.getByRole("button", { name: "Expand row 1" }));
    expect(await screen.findByRole("dialog", { name: /Room: 101/ })).toBeVisible();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Local Edit");
    await user.click(screen.getByRole("button", { name: "Save room" }));

    expect((await screen.findAllByText(/locked elsewhere/))[0]).toBeVisible();
    expect(screen.getByDisplayValue("Local Edit")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save room" })).toBeDisabled();
  });

  test("keeps the window refresh dialog open when apply fails", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/windows`);
    const windowsUrl = `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/draft/tables/window_types`;
    const refreshUrl = `/api/v1/projects/${projectPayload.id}/versions/${projectPayload.active_version_id}/refresh/window-types?source=draft`;
    const draftUrl = draftSummaryUrl();

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url.startsWith("/api/v1/catalogs/frame-types")) return jsonResponse({ items: [] });
      if (url.startsWith("/api/v1/catalogs/glazing-types")) return jsonResponse({ items: [] });
      if (url === refreshUrl) return jsonResponse(windowTypesRefreshPayload);
      if (url === windowsUrl && init?.method !== "PUT")
        return jsonResponse(windowTypesSlicePayload);
      if (url === windowsUrl && init?.method === "PUT") {
        return apiErrorResponse(409, "draft_etag_mismatch", "The draft changed elsewhere.");
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Review refresh" }));
    const dialog = await screen.findByRole("dialog", { name: "Review catalog refresh" });
    expect(within(dialog).getByText("name")).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(
      await screen.findByText("The draft changed elsewhere. (Request ID: test)"),
    ).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Review catalog refresh" })).toBeVisible();
  });
});
