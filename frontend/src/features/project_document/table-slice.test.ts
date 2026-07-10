import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import type { FieldSchemaMutation } from "../../shared/ui/data-table/lib/customFieldMutations";
import { createTableSliceFeature, type BaseTableSlice } from "./table-slice";
import { projectDocumentQueryKeys } from "./query-keys";

type FakeSlice = BaseTableSlice & { rows: string[] };
type FakeReplaceBody = { rows: string[] };

const projectId = "p1";
const versionId = "v1";

function makeSlice(overrides: Partial<FakeSlice> = {}): FakeSlice {
  return {
    project_id: projectId,
    version_id: versionId,
    source: "version",
    version_etag: "ver-etag-1",
    draft_etag: null,
    rows: [],
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

function queryWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("createTableSliceFeature", () => {
  const feature = createTableSliceFeature<FakeSlice, FakeReplaceBody>({
    tableName: "fake_table",
    missingVersionMessage: "no version",
  });

  it("query keys are namespaced under project-document-tables/<tableName>", () => {
    const sliceKey = feature.queryKeys.slice(projectId, versionId, "editor");
    expect(sliceKey).toEqual([
      "project-document-tables",
      "project",
      projectId,
      "table",
      "fake_table",
      "slice",
      versionId,
      "editor",
    ]);
  });

  it("fetchSlice hits the draft endpoint for editor and document endpoint for viewer", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSlice()));
    await feature.fetchSlice(projectId, versionId, "editor");
    expect(fetchMock.mock.calls[0]?.[0]).toContain(`/draft/tables/fake_table`);

    fetchMock.mockResolvedValueOnce(jsonResponse(makeSlice()));
    await feature.fetchSlice(projectId, versionId, "viewer");
    expect(fetchMock.mock.calls[1]?.[0]).toContain(`/document/tables/fake_table`);
  });

  it("mutateSchema posts to the :mutate endpoint with the typed mutation body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSlice({ draft_etag: "d-mut" })));
    const mutation: FieldSchemaMutation = {
      kind: "addField",
      tableKey: "fake_table",
      after: {
        field_key: "cf_x",
        display_name: "X",
        field_type: "short_text",
        config: {},
        description: null,
        origin: "custom",
        created_at: "2026-05-24T12:00:00Z",
        created_by: null,
      },
      expectedSchemaFingerprint: "fp-abc",
    };
    await feature.mutateSchema(projectId, versionId, makeSlice(), mutation);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/draft/tables/fake_table/custom-fields:mutate");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("If-Match-Version")).toBe("ver-etag-1");
    expect(JSON.parse(String(init.body))).toEqual(mutation);
  });

  it("replaceSlice sends If-Match-Version when there is no draft, and If-Match when a draft exists", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSlice({ draft_etag: "d1" })));
    await feature.replaceSlice(projectId, versionId, makeSlice(), { rows: ["a"] });
    let init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    let headers = new Headers(init.headers);
    expect(init.method).toBe("PUT");
    expect(headers.get("If-Match")).toBeNull();
    expect(headers.get("If-Match-Version")).toBe("ver-etag-1");

    fetchMock.mockResolvedValueOnce(jsonResponse(makeSlice({ draft_etag: "d2" })));
    await feature.replaceSlice(
      projectId,
      versionId,
      makeSlice({ draft_etag: "d1", source: "draft" }),
      { rows: ["b"] },
    );
    init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    headers = new Headers(init.headers);
    expect(headers.get("If-Match")).toBe("d1");
    expect(headers.get("If-Match-Version")).toBeNull();
  });

  it("invalidates sibling editor table slices after an accepted draft write", async () => {
    const sourceFeature = createTableSliceFeature<FakeSlice, FakeReplaceBody>({
      tableName: "source_table",
      missingVersionMessage: "no version",
    });
    const siblingFeature = createTableSliceFeature<FakeSlice, FakeReplaceBody>({
      tableName: "sibling_table",
      missingVersionMessage: "no version",
    });
    const queryClient = new QueryClient();
    const current = makeSlice({
      rows: ["old-source"],
      source: "draft",
      draft_etag: "draft-old",
    });
    const accepted = makeSlice({
      rows: ["new-source"],
      source: "draft",
      draft_etag: "draft-new",
    });
    const sourceEditorKey = sourceFeature.queryKeys.slice(projectId, versionId, "editor");
    const siblingEditorKey = siblingFeature.queryKeys.slice(projectId, versionId, "editor");
    const siblingViewerKey = siblingFeature.queryKeys.slice(projectId, versionId, "viewer");
    const siblingOtherVersionKey = siblingFeature.queryKeys.slice(projectId, "v2", "editor");
    const draftSummaryKey = projectDocumentQueryKeys.draftSummary(projectId, versionId);
    queryClient.setQueryData(sourceEditorKey, current);
    queryClient.setQueryData(
      siblingEditorKey,
      makeSlice({ rows: ["old-sibling"], draft_etag: "draft-old" }),
    );
    queryClient.setQueryData(siblingViewerKey, makeSlice({ rows: ["saved-sibling"] }));
    queryClient.setQueryData(siblingOtherVersionKey, makeSlice({ version_id: "v2" }));
    queryClient.setQueryData(draftSummaryKey, {
      project_id: projectId,
      version_id: versionId,
      source: "draft",
      version_etag: "version-etag",
      draft_etag: "draft-old",
      dirty_tables: [],
      last_patched_at: null,
      is_locked: false,
      can_edit: true,
    });
    const siblingRefetch = vi.fn(async () => makeSlice({ rows: ["refetched-sibling"] }));
    const siblingObserver = new QueryObserver(queryClient, {
      queryKey: siblingEditorKey,
      queryFn: siblingRefetch,
      staleTime: Infinity,
    });
    const unsubscribe = siblingObserver.subscribe(() => undefined);
    fetchMock.mockResolvedValueOnce(jsonResponse(accepted));

    try {
      const { result } = renderHook(
        () => sourceFeature.useReplaceSliceMutation(projectId, versionId),
        {
          wrapper: queryWrapper(queryClient),
        },
      );
      await act(async () => {
        await result.current.mutateAsync({ current, payload: { rows: ["new-source"] } });
      });
    } finally {
      unsubscribe();
    }

    expect(queryClient.getQueryData(sourceEditorKey)).toEqual(accepted);
    expect(queryClient.getQueryState(sourceEditorKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(siblingEditorKey)?.isInvalidated).toBe(true);
    expect(siblingRefetch).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(siblingViewerKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(siblingOtherVersionKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(draftSummaryKey)).toMatchObject({
      draft_etag: "draft-new",
      dirty_tables: ["source_table"],
    });
    expect(queryClient.getQueryState(draftSummaryKey)?.isInvalidated).toBe(false);
  });
});
