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
import { useInstallTypeWrites } from "../useInstallTypeWrites";
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

describe("useInstallTypeWrites", () => {
  test("creates a second type after an aperture command bumped the draft etag", async () => {
    const { result } = renderHook(
      () => ({
        writes: useInstallTypeWrites(project()),
        command: useApplyApertureCommandMutation(PROJECT_ID, VERSION_ID),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.writes.ready).toBe(true));

    await act(async () => {
      expect(
        await result.current.writes.commit([{ id: "apit_side", name: "Side", psiWmk: 0.023 }], []),
      ).toBeNull();
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
      expect(
        await result.current.writes.commit(
          [{ id: "apit_half", name: "Half Side", psiWmk: 0.01 }],
          [],
        ),
      ).toBeNull();
    });

    expect(writes()).toHaveLength(3);
    for (const { init } of writes()) {
      expect(new Headers(init?.headers).get("If-Match")).not.toBeNull();
    }
  });

  test("a patch renames without touching an unedited psi-value", async () => {
    const { result } = renderHook(() => useInstallTypeWrites(project()), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      expect(await result.current.commit([], [{ id: "apit_1", name: "Head" }])).toBeNull();
    });

    expect(writtenRow()).toMatchObject({ name: "Head", psi_w_mk: 0.0398 });
  });

  test("a patch writes an edited psi-value", async () => {
    const { result } = renderHook(() => useInstallTypeWrites(project()), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      expect(
        await result.current.commit([], [{ id: "apit_1", name: "Side", psiWmk: 0.05 }]),
      ).toBeNull();
    });

    expect(writtenRow()).toMatchObject({ name: "Side", psi_w_mk: 0.05 });
  });

  test("one commit sends staged creates and patches as a single table write", async () => {
    const { result } = renderHook(() => useInstallTypeWrites(project()), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      expect(
        await result.current.commit(
          [{ id: "apit_new", name: "Jamb", psiWmk: 0.02 }],
          [{ id: "apit_1", name: "Head", psiWmk: 0.03 }],
        ),
      ).toBeNull();
    });

    // One replace_table PUT carries both — one round trip, one draft-etag bump.
    expect(writes()).toHaveLength(1);
    const body = JSON.parse(String(writes()[0]?.init?.body)) as {
      aperture_install_types: { id: string }[];
    };
    expect(body.aperture_install_types.map((row) => row.id)).toContain("apit_new");
    expect(writtenRow()).toMatchObject({ name: "Head", psi_w_mk: 0.03 });
  });
});

/** Every non-GET request the hook sent, in order. */
function writes(): { init: RequestInit | undefined }[] {
  return fetchMock.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") !== "GET")
    .map(([, init]) => ({ init }));
}

/** `custom_values` of `apit_1` in the last write the hook sent. */
function writtenRow(): Record<string, unknown> {
  const body = JSON.parse(String(writes().at(-1)?.init?.body)) as {
    aperture_install_types: { id: string; custom_values: Record<string, unknown> }[];
  };
  const row = body.aperture_install_types.find((entry) => entry.id === "apit_1");
  if (!row) throw new Error("apit_1 missing from the written payload.");
  return row.custom_values;
}

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
    aperture_install_types: [
      {
        id: "apit_1",
        pdf_report_asset_ids: [],
        datasheet_asset_ids: [],
        photo_asset_ids: [],
        notes: null,
        custom_values: { record_id: "W-1", name: "Side", psi_w_mk: 0.0398 },
      },
    ],
    field_defs: [tableFieldDef({ field_key: "record_id", display_name: "Tag" })],
    single_select_options: {
      [APERTURE_INSTALL_SOURCE_OPTION_KEY]: [],
      [APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY]: [
        { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 0 },
      ],
    },
  };
}
