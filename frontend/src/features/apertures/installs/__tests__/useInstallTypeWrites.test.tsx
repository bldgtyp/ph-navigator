// Regression cover for the Installs-modal bug where a second "New type"
// in one modal session 409'd with "The draft changed before this table
// update was applied." An aperture command (edge paint) is a document
// write, so it bumps the draft-wide etag; the install-types slice cache
// kept the pre-paint etag and the next create sent it as `If-Match`.
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../../app/query-client";
import { tableFieldDef } from "../../../equipment/testing/testFixtures";
import { APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY } from "../../../../shared/ui/data-table/status";
import type { ProjectDetail } from "../../../projects/types";
import { useApplyApertureCommandMutation } from "../../hooks";
import type { AperturesSlice } from "../../types";
import { useCreateInstallType } from "../useCreateInstallType";
import { APERTURE_INSTALL_SOURCE_OPTION_KEY, type InstallTypesSlice } from "../types";

const PROJECT_ID = "proj_1";
const VERSION_ID = "ver_1";

// The fake server behaves like the real one: one draft etag for the whole
// document, bumped by every write, and 412/409 on a superseded `If-Match`.
let draftEtag: string;
let etagCounter: number;
const fetchMock = vi.fn();

beforeEach(() => {
  draftEtag = "etag-0";
  etagCounter = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const isInstallTypes = url.includes("/tables/aperture_install_types");
    const isCommand = url.includes("/apertures/command");
    if (method === "GET") {
      return jsonResponse(isInstallTypes ? installTypesSlice() : aperturesSlice());
    }
    const ifMatch = new Headers(init?.headers).get("If-Match");
    if (ifMatch !== draftEtag) {
      return jsonResponse(
        { detail: { message: "The draft changed before this table update was applied." } },
        409,
      );
    }
    draftEtag = `etag-${++etagCounter}`;
    return jsonResponse(isCommand ? aperturesSlice() : installTypesSlice());
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCreateInstallType", () => {
  test("creates a second type after an aperture command bumped the draft etag", async () => {
    const { result } = renderHook(
      () => ({
        create: useCreateInstallType(project()),
        command: useApplyApertureCommandMutation(PROJECT_ID, VERSION_ID),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.create.ready).toBe(true));

    await act(async () => {
      expect(await result.current.create.create("Side", 0.023)).toBeNull();
    });

    // Paint an edge — the write path the modal uses for its canvas clicks.
    await act(async () => {
      await result.current.command.mutateAsync({
        current: aperturesSlice(),
        command: {
          kind: "setElementInstall",
          aperture_type_id: "apt_1",
          element_id: "el_1",
          side: "left",
          install_type_id: "apit_side",
        },
      });
    });

    await act(async () => {
      expect(await result.current.create.create("Half Side", 0.01)).toBeNull();
    });

    const writes = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") !== "GET");
    expect(writes).toHaveLength(3);
    for (const [, init] of writes) {
      expect(new Headers(init?.headers).get("If-Match")).not.toBeNull();
    }
  });
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function project(): ProjectDetail {
  return {
    id: PROJECT_ID,
    active_version_id: VERSION_ID,
    access_mode: "editor",
  } as ProjectDetail;
}

function aperturesSlice(): AperturesSlice {
  return {
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    source: "draft",
    version_etag: "v1",
    draft_etag: draftEtag,
    apertures: [],
    project_glazings: [],
    project_frames: [],
    aperture_install_types: [],
    manufacturer_filters: null,
  };
}

function installTypesSlice(): InstallTypesSlice {
  return {
    project_id: PROJECT_ID,
    version_id: VERSION_ID,
    source: "draft",
    version_etag: "v1",
    draft_etag: draftEtag,
    aperture_install_types: [],
    field_defs: [tableFieldDef({ field_key: "record_id", display_name: "Tag" })],
    single_select_options: {
      [APERTURE_INSTALL_SOURCE_OPTION_KEY]: [],
      [APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY]: [
        { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 0 },
      ],
    },
  };
}
