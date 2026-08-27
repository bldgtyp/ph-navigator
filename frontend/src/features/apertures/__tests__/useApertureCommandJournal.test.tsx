import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetDraftWriteCoordinatorsForTests } from "../../project_document/draftWriteCoordinator";
import { apertureQueryKeys } from "../query-keys";
import { useApertureCommandJournal } from "../hooks/useApertureCommandJournal";
import type { ApertureSpecReportResponse } from "../types";
import { PROJECT_ID, VERSION_ID, specReportSlice as slice } from "./spec-report-fixtures";

const fetchMock = vi.fn();

beforeEach(() => {
  resetDraftWriteCoordinatorsForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderJournal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const readKey = apertureQueryKeys.specReport(PROJECT_ID, VERSION_ID, "draft");
  queryClient.setQueryData(readKey, slice());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const setActionError = vi.fn();
  const view = renderHook(
    () =>
      useApertureCommandJournal({
        projectId: PROJECT_ID,
        versionId: VERSION_ID,
        source: "draft",
        slice: queryClient.getQueryData<ApertureSpecReportResponse>(readKey),
        refetch: async () => ({ data: queryClient.getQueryData(readKey) }),
        setActionError,
      }),
    { wrapper },
  );
  const cached = () => queryClient.getQueryData<ApertureSpecReportResponse>(readKey)!;
  return { view, cached, setActionError };
}

function commandRequests(): unknown[] {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).includes("/draft/envelope/commands"))
    .map((call) => JSON.parse(call[1]?.body as string));
}

function writeResponse(draftEtag: string): Response {
  return new Response(
    JSON.stringify({ version_id: VERSION_ID, version_etag: "version-etag", draft_etag: draftEtag }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("useApertureCommandJournal", () => {
  test("renders a glazing status change before the server answers", async () => {
    const gates: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => gates.push(resolve)));
    const { view, cached } = renderJournal();

    expect(
      view.result.current.submit({
        kind: "update_project_glazing",
        project_glazing_id: "pglz_a",
        specification_status: "complete",
      }),
    ).toBe(true);

    await waitFor(() =>
      expect(cached().project_glazings[0]?.specification_status).toBe("complete"),
    );
    expect(cached().project_glazings[1]?.specification_status).toBe("needed");
    expect(commandRequests()).toHaveLength(1);

    // The endpoint answers with the envelope read model, so the acknowledgement
    // is the optimistic projection carrying the server's new ETag.
    gates[0]!(writeResponse("draft-etag-1"));
    await waitFor(() => expect(cached().draft_etag).toBe("draft-etag-1"));
    expect(cached().project_glazings[0]?.specification_status).toBe("complete");
  });

  test("coalesces glazing and frame writes queued behind an in-flight one", async () => {
    const gates: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => gates.push(resolve)));
    const { view, cached } = renderJournal();

    view.result.current.submit({
      kind: "update_project_glazing",
      project_glazing_id: "pglz_a",
      specification_status: "complete",
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    view.result.current.submit({
      kind: "update_project_frame",
      project_frame_id: "pfrm_a",
      specification_status: "question",
    });
    view.result.current.submit({
      kind: "update_project_glazing",
      project_glazing_id: "pglz_b",
      datasheet_not_required: true,
    });
    await waitFor(() => expect(cached().project_frames[0]?.specification_status).toBe("question"));

    gates[0]!(writeResponse("draft-etag-1"));
    await waitFor(() => expect(gates).toHaveLength(2));
    gates[1]!(writeResponse("draft-etag-2"));

    await waitFor(() => expect(cached().draft_etag).toBe("draft-etag-2"));
    expect(commandRequests()).toHaveLength(2);
    expect(commandRequests()[1]).toEqual({
      commands: [
        {
          kind: "update_project_frame",
          project_frame_id: "pfrm_a",
          specification_status: "question",
        },
        {
          kind: "update_project_glazing",
          project_glazing_id: "pglz_b",
          datasheet_not_required: true,
        },
      ],
    });
    expect(cached().project_glazings[1]?.datasheet_not_required).toBe(true);
  });

  test("declines a row-removing command so the caller awaits it", () => {
    const { view } = renderJournal();
    expect(
      view.result.current.submit({
        kind: "remove_project_glazing",
        project_glazing_id: "pglz_a",
      }),
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reverts and reports when the write is rejected", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: { message: "Nope." } }), { status: 500 }),
    );
    const { view, cached, setActionError } = renderJournal();

    view.result.current.submit({
      kind: "update_project_glazing",
      project_glazing_id: "pglz_a",
      specification_status: "complete",
    });

    await waitFor(() => expect(cached().project_glazings[0]?.specification_status).toBe("needed"));
    expect(setActionError).toHaveBeenCalledWith(
      expect.stringContaining("1 unsaved change was discarded."),
    );
  });
});
