import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  heatPumpOutdoorEquipSliceFeature,
  heatPumpsQueryKeys,
  useHeatPumpOptionMutation,
} from "../api";
import { HEAT_PUMP_OPTION_KEYS } from "../types";
import { heatPumpsSlice } from "./heatPumpsPanelHarness";

const PROJECT_ID = "proj_1";
const VERSION_ID = "ver_1";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function queryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("Heat Pumps API mutations", () => {
  test("legacy aggregate option writes invalidate generic leaf table slices", async () => {
    const queryClient = new QueryClient();
    const current = heatPumpsSlice({ source: "draft", draft_etag: "draft-old" });
    const accepted = heatPumpsSlice({ source: "draft", draft_etag: "draft-new" });
    const aggregateKey = heatPumpsQueryKeys.slice(PROJECT_ID, "editor");
    const outdoorEquipLeafKey = heatPumpOutdoorEquipSliceFeature.queryKeys.slice(
      PROJECT_ID,
      VERSION_ID,
      "editor",
    );
    queryClient.setQueryData(aggregateKey, current);
    queryClient.setQueryData(outdoorEquipLeafKey, {
      project_id: PROJECT_ID,
      version_id: VERSION_ID,
      source: "draft",
      version_etag: "version_1",
      draft_etag: "draft-old",
      field_defs: [],
      outdoor_equip: current.outdoor_equip,
      single_select_options: current.single_select_options,
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(accepted));

    const { result } = renderHook(() => useHeatPumpOptionMutation(PROJECT_ID), {
      wrapper: queryWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({
        current,
        optionKey: HEAT_PUMP_OPTION_KEYS.manufacturer,
        patch: {
          op: "add",
          option: { id: "opt_daikin", label: "Daikin", color: "#93c5fd", order: 1 },
        },
      });
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("If-Match")).toBe("draft-old");
    expect(queryClient.getQueryData(aggregateKey)).toEqual(accepted);
    expect(queryClient.getQueryState(outdoorEquipLeafKey)?.isInvalidated).toBe(true);
  });
});
