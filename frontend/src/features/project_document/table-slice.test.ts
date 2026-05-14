import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTableSliceFeature, type BaseTableSlice } from "./table-slice";

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
});
