import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryClient } from "../../../../app/query-client";
import { heatPumpsQueryKeys, useHeatPumpPatchMutation } from "../api";
import type { HeatPumpsSlice } from "../types";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHeatPumpPatchMutation — fresh-etag read", () => {
  test("uses the cache's latest draft_etag, not the caller-supplied stale slice", async () => {
    const projectId = "proj_1";
    const queryClient = createQueryClient();

    // Simulate the state AFTER a successful cross-table edit (e.g. an
    // indoor-units PATCH from the Units-Indoor sub-tab). The query cache
    // now holds a slice with a real draft_etag.
    const fresh = sliceWithEtags({ draft_etag: "draft_after_indoor", version_etag: "version_1" });
    queryClient.setQueryData(heatPumpsQueryKeys.slice(projectId, "editor"), fresh);

    fetchMock.mockResolvedValue(jsonResponse({ ...fresh, draft_etag: "draft_after_outdoor" }));

    const { result } = renderHook(() => useHeatPumpPatchMutation(projectId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // The caller (e.g. a stale closure from the Units-Outdoor sub-tab on
    // its first render) still thinks no draft exists yet.
    const stale = sliceWithEtags({ draft_etag: null, version_etag: "version_1" });
    await result.current.mutateAsync({
      current: stale,
      table: "outdoor-units",
      patch: {
        op: "replace",
        path: "/hpou_01HX0000000000000000000000",
        value: {
          id: "hpou_01HX0000000000000000000000",
          tag: "HP-1",
          outdoor_equip_id: "hpoe_01HX0000000000000000000000",
          building_zone: null,
          datasheet_asset_ids: [],
          notes: null,
        },
      },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("If-Match")).toBe("draft_after_indoor");
    expect(headers.get("If-Match-Version")).toBeNull();
  });

  test("falls back to caller's slice when nothing is cached", async () => {
    const projectId = "proj_1";
    const queryClient = createQueryClient();

    fetchMock.mockResolvedValue(
      jsonResponse(sliceWithEtags({ draft_etag: "draft_1", version_etag: "version_1" })),
    );

    const { result } = renderHook(() => useHeatPumpPatchMutation(projectId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    const caller = sliceWithEtags({ draft_etag: null, version_etag: "version_caller" });
    await result.current.mutateAsync({
      current: caller,
      table: "outdoor-units",
      patch: {
        op: "replace",
        path: "/hpou_01HX0000000000000000000000",
        value: {
          id: "hpou_01HX0000000000000000000000",
          tag: "HP-1",
          outdoor_equip_id: "hpoe_01HX0000000000000000000000",
          building_zone: null,
          datasheet_asset_ids: [],
          notes: null,
        },
      },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("If-Match")).toBeNull();
    expect(headers.get("If-Match-Version")).toBe("version_caller");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sliceWithEtags(etags: {
  draft_etag: string | null;
  version_etag: string;
}): HeatPumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: etags.draft_etag ? "draft" : "version",
    version_etag: etags.version_etag,
    draft_etag: etags.draft_etag,
    outdoor_equip: [],
    indoor_equip: [],
    outdoor_units: [],
    indoor_units: [],
    single_select_options: {},
  };
}
