import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { createTableSliceFeature, type BaseTableSlice } from "./table-slice";
import { useDraftTablesBatchSeed } from "./draftTablesBatchSeed";

type FakeSlice = BaseTableSlice & { rows: string[] };
type FakeReplaceBody = { rows: string[] };

const projectId = "p1";
const versionId = "v1";

function makeSlice(tag: string, overrides: Partial<FakeSlice> = {}): FakeSlice {
  return {
    project_id: projectId,
    version_id: versionId,
    source: "draft",
    version_etag: "ver-etag-1",
    draft_etag: "draft-1",
    rows: [tag],
    ...overrides,
  };
}

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

function urlOf(call: unknown[]): string {
  return String(call[0]);
}

function perTableGetCount(name: string): number {
  return fetchMock.mock.calls.filter(
    (call) => urlOf(call).includes(`/draft/tables/${name}`) && urlOf(call).endsWith(name),
  ).length;
}

function batchGetCount(): number {
  return fetchMock.mock.calls.filter((call) => urlOf(call).includes("/draft/tables?names=")).length;
}

// Route the global fetch by URL: the batch endpoint vs. the per-table endpoint.
function routeFetch(handlers: { batch?: () => Response; perTable?: (name: string) => Response }) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/draft/tables?names=")) {
      if (handlers.batch) return Promise.resolve(handlers.batch());
      return Promise.reject(new Error("unexpected batch call"));
    }
    const name = url.match(/\/draft\/tables\/([^/?]+)$/)?.[1];
    if (name && handlers.perTable) return Promise.resolve(handlers.perTable(name));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

const pumpsFeature = createTableSliceFeature<FakeSlice, FakeReplaceBody>({
  tableName: "pumps",
  missingVersionMessage: "no version",
});

function queryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// Mirrors EquipmentPage's wiring: seed first, gate the per-table query on
// `!isSeeding`.
function useSeedAndPumps(enabledSeed: boolean) {
  const { isSeeding } = useDraftTablesBatchSeed({
    projectId,
    versionId,
    tableNames: ["pumps"],
    enabled: enabledSeed,
  });
  const query = pumpsFeature.useSliceQuery(projectId, versionId, "editor", !isSeeding);
  return { isSeeding, query };
}

describe("useDraftTablesBatchSeed", () => {
  it("seeds the per-table cache so the gated query reads it with zero per-table GETs", async () => {
    const seeded = makeSlice("seeded-pumps");
    routeFetch({ batch: () => jsonResponse({ tables: { pumps: seeded } }) });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSeedAndPumps(true), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.query.data).toEqual(seeded));
    expect(batchGetCount()).toBe(1);
    // The whole point: the per-table GET never fired.
    expect(perTableGetCount("pumps")).toBe(0);
    expect(result.current.isSeeding).toBe(false);
  });

  it("falls back to a per-table GET when seeding is disabled (e.g. viewer)", async () => {
    const perTable = makeSlice("fetched-pumps");
    routeFetch({ perTable: () => jsonResponse(perTable) });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSeedAndPumps(false), {
      wrapper: queryWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.query.data).toEqual(perTable));
    expect(batchGetCount()).toBe(0);
    expect(perTableGetCount("pumps")).toBe(1);
  });

  it("falls back to a per-table GET when the batch read fails", async () => {
    const perTable = makeSlice("fetched-after-batch-failure");
    routeFetch({
      batch: () => jsonResponse({ error_code: "boom" }, 500),
      perTable: () => jsonResponse(perTable),
    });
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useSeedAndPumps(true), {
      wrapper: queryWrapper(queryClient),
    });

    // After the batch fails, the gate releases and the per-table query fetches.
    await waitFor(() => expect(result.current.query.data).toEqual(perTable));
    expect(perTableGetCount("pumps")).toBe(1);
  });
});
