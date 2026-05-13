import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./app/App";

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
  single_select_options: {
    "rooms.floor_level": [],
    "rooms.building_zone": [],
  },
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
      await screen.findByRole("heading", { name: "Session service unavailable." }),
    ).toBeVisible();
    expect(screen.getByText("Session check failed")).toBeVisible();
    expect(window.location.pathname).toBe("/dashboard");
  });

  test("redirects authenticated root visits to dashboard", async () => {
    window.history.pushState({}, "", "/");
    fetchMock
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(() => jsonResponse({ projects: [] }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "My Projects" })).toBeVisible();
    expect(window.location.pathname).toBe("/dashboard");
  });

  test("signs in and renders the empty dashboard shell", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/sign-in?next=%2Fdashboard");
    fetchMock
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(sessionResponse)
      .mockImplementationOnce(() => jsonResponse({ projects: [] }));

    render(<App />);

    await user.type(screen.getByLabelText("Email"), "ed@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "My Projects" })).toBeVisible();
    expect(await screen.findByText("No projects yet")).toBeVisible();
    expect(screen.getByText("Ed May")).toBeVisible();
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

    await user.click(await screen.findByRole("button", { name: "New project" }));
    await user.type(screen.getByLabelText("Project name"), "West Stockbridge House");
    await user.type(screen.getByLabelText("BT number"), "2426");
    await user.type(screen.getByLabelText("Client"), "May");
    await user.click(screen.getByLabelText("PHI"));
    expect(await screen.findByText("BT number available")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { name: "West Stockbridge House" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Status" })).toBeVisible();
    expect(window.location.pathname).toBe(`/projects/${projectPayload.id}/status`);
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
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
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
    window.history.pushState({}, "", `/projects/${projectPayload.id}/status`);
    const draftUrl = draftSummaryUrl();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/v1/projects/${projectPayload.id}`) return jsonResponse(projectPayload);
      if (url === draftUrl) return jsonResponse(draftSummaryPayload);
      if (url === `/api/v1/projects/${projectPayload.id}/status-items`) {
        return jsonResponse({ items: [statusItemPayload] });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByText("Clean")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Rooms JSON" })).not.toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: "Working · Locked" })).toBeVisible();
    expect(await screen.findByText("Unsaved")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save As" })).toBeVisible();
  });

  test("renders read-safe recovery when the editor draft summary is unsupported", async () => {
    window.history.pushState({}, "", `/projects/${projectPayload.id}/equipment`);
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
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Equipment" })).not.toBeInTheDocument();
  });

  test("renders public read-safe recovery without editor diagnostics", async () => {
    window.history.pushState(
      {},
      "",
      `/projects/${projectPayload.id}/equipment?version=${projectPayload.active_version_id}#viewer`,
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
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
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

    expect(await screen.findByText("Editor")).toBeVisible();
    expect(screen.queryByText("Read-only public view")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set CAD files received to Done/ })).toBeVisible();
  });

  test("routes the Catalogs dropdown to the live catalog placeholders", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/dashboard");
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/v1/auth/session") return sessionResponse();
      if (url === "/api/v1/projects") return jsonResponse({ projects: [] });
      return jsonResponse({}, 404);
    });

    render(<App />);

    await user.click(await screen.findByText("Catalogs"));
    await user.click(screen.getByRole("link", { name: "Materials" }));

    expect(await screen.findByRole("heading", { name: "Materials" })).toBeVisible();
    expect(screen.getByText("Catalog manager pending")).toBeVisible();
    expect(window.location.pathname).toBe("/catalog/materials");
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

  test("adds a room through the Equipment tab draft path", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", `/projects/${projectPayload.id}/equipment`);
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
          single_select_options: saved.single_select_options,
        });
      }
      return jsonResponse({}, 404);
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Equipment" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Add room" }));
    await user.type(screen.getByLabelText("Number"), "101");
    await user.type(screen.getByLabelText("Name"), "Living Room");
    await user.type(screen.getByLabelText("Floor level"), "Ground");
    await user.type(screen.getByLabelText("Building zone"), "Residential");
    await user.click(screen.getByRole("button", { name: "Save room" }));

    expect(await screen.findByText("Unsaved Rooms draft restored")).toBeVisible();
    expect(await screen.findByText("Unsaved")).toBeVisible();
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
});
