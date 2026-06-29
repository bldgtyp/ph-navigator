import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { projectDocumentTableQueryKeys } from "../../../../features/project_document/query-keys";
import type { BaseTableSlice } from "../../../../features/project_document/table-slice";
import type { FieldSchemaMutation } from "../lib/customFieldMutations";
import type { BuildEmptyRow, FieldOption, RowInsertPayload } from "../types";
import {
  useSliceTableController,
  type SliceTableReplaceMutation,
  type SliceTableSchemaMutation,
} from "./useSliceTableController";
import type { SlicePayloadBuilders } from "./types";

type FakeRow = { id: string };
type FakeSlice = BaseTableSlice & { rows: string[] };
type FakePayload = { rows: string[] };

const projectId = "p1";
const versionId = "v1";
const tableKey = "fake_table";

function makeSlice(overrides: Partial<FakeSlice> = {}): FakeSlice {
  return {
    project_id: projectId,
    version_id: versionId,
    source: "draft",
    version_etag: "version-1",
    draft_etag: "draft-old",
    rows: ["old"],
    ...overrides,
  };
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function editorSliceQueryKey() {
  return [
    ...projectDocumentTableQueryKeys.table(projectId, tableKey),
    "slice",
    versionId,
    "editor",
  ] as const;
}

function makePayloadBuilders(
  fromRowInsert = vi.fn(
    (slice: FakeSlice, _rows: RowInsertPayload[], build: BuildEmptyRow<FakeRow>) => ({
      rows: [...slice.rows, build({ rowId: "new-row", fieldDefaults: {}, anchorRow: null }).id],
    }),
  ),
): SlicePayloadBuilders<FakeSlice, FakeRow, FakePayload> {
  return {
    fromCellWrites: vi.fn((slice) => ({ rows: slice.rows })),
    fromRowInsert,
    fromRowDelete: vi.fn((slice) => ({ rows: slice.rows })),
    fromRowDuplicate: vi.fn((slice) => ({ rows: slice.rows })),
    validate: vi.fn(() => null),
  };
}

function renderController({
  queryClient,
  slice,
  refetch,
  payloadBuilders = makePayloadBuilders(),
  replaceMutate = vi.fn(
    async ({ current }: { current: FakeSlice; payload: FakePayload }) => current,
  ),
  schemaMutate = vi.fn(
    async ({ current }: { current: FakeSlice; mutation: FieldSchemaMutation }) => current,
  ),
}: {
  queryClient: QueryClient;
  slice: FakeSlice;
  refetch: () => Promise<unknown>;
  payloadBuilders?: SlicePayloadBuilders<FakeSlice, FakeRow, FakePayload>;
  replaceMutate?: (args: { current: FakeSlice; payload: FakePayload }) => Promise<FakeSlice>;
  schemaMutate?: (args: {
    current: FakeSlice;
    mutation: FieldSchemaMutation;
  }) => Promise<FakeSlice>;
}) {
  return renderHook(
    () =>
      useSliceTableController<FakeSlice, FakeRow, FakePayload>({
        projectId,
        activeVersionId: versionId,
        accessMode: "editor",
        versionLocked: false,
        tableKey,
        slice,
        fieldDefs: null,
        singleSelectOptions: null as Record<string, FieldOption[]> | null,
        columnsForSanitize: [],
        payloadBuilders,
        conflictMessages: {
          activeRowConflict: "Draft changed.",
          deleteConflict: "Delete failed.",
          versionLocked: "Version locked.",
        },
        buildEmptyRow: ({ rowId }) => ({ id: rowId }),
        activeRow: null,
        replaceMutation: {
          mutateAsync: replaceMutate,
          isPending: false,
        } as unknown as SliceTableReplaceMutation<FakeSlice, FakePayload>,
        schemaMutation: {
          mutateAsync: schemaMutate,
        } as unknown as SliceTableSchemaMutation<FakeSlice>,
        refetch,
        viewStateEnabled: false,
      }),
    { wrapper: wrapper(queryClient) },
  );
}

describe("useSliceTableController write freshness", () => {
  it("refetches an invalidated editor slice before building a row-insert payload", async () => {
    const queryClient = new QueryClient();
    const staleSlice = makeSlice({ draft_etag: "draft-old", rows: ["old"] });
    const freshSlice = makeSlice({
      draft_etag: "draft-new",
      rows: ["old", "remote-safe-row"],
    });
    queryClient.setQueryData(editorSliceQueryKey(), staleSlice);
    await queryClient.invalidateQueries({ queryKey: editorSliceQueryKey(), refetchType: "none" });
    const refetch = vi.fn(async () => ({ data: freshSlice }));
    const fromRowInsert = vi.fn(
      (slice: FakeSlice, _rows: RowInsertPayload[], build: BuildEmptyRow<FakeRow>) => ({
        rows: [...slice.rows, build({ rowId: "new-row", fieldDefaults: {}, anchorRow: null }).id],
      }),
    );
    const replaceMutate = vi.fn(
      async ({ current }: { current: FakeSlice; payload: FakePayload }) => current,
    );
    const { result } = renderController({
      queryClient,
      slice: staleSlice,
      refetch,
      payloadBuilders: makePayloadBuilders(fromRowInsert),
      replaceMutate,
    });

    await act(async () => {
      await result.current.onWrite({
        kind: "rowInsert",
        rows: [{ rowId: "new-row", anchorRowId: null, fieldDefaults: {} }],
      });
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fromRowInsert).toHaveBeenCalledWith(
      freshSlice,
      [{ rowId: "new-row", anchorRowId: null, fieldDefaults: {} }],
      expect.any(Function),
    );
    expect(replaceMutate).toHaveBeenCalledWith({
      current: freshSlice,
      payload: { rows: ["old", "remote-safe-row", "new-row"] },
    });
  });

  it("uses a fresh invalidated editor slice for typed schema mutations", async () => {
    const queryClient = new QueryClient();
    const staleSlice = makeSlice({ draft_etag: "draft-old" });
    const freshSlice = makeSlice({ draft_etag: "draft-new" });
    queryClient.setQueryData(editorSliceQueryKey(), staleSlice);
    await queryClient.invalidateQueries({ queryKey: editorSliceQueryKey(), refetchType: "none" });
    const refetch = vi.fn(async () => ({ data: freshSlice }));
    const schemaMutate = vi.fn(
      async ({ current }: { current: FakeSlice; mutation: FieldSchemaMutation }) => current,
    );
    const mutation: FieldSchemaMutation = {
      kind: "addField",
      tableKey,
      after: {
        field_key: "cf_test",
        display_name: "Test",
        field_type: "short_text",
        config: {},
        description: null,
        origin: "custom",
        created_at: "2026-06-29T21:00:00Z",
        created_by: null,
      },
      expectedSchemaFingerprint: "fp-old",
    };
    const { result } = renderController({
      queryClient,
      slice: staleSlice,
      refetch,
      schemaMutate,
    });

    await act(async () => {
      await result.current.onWrite({ kind: "schemaMutation", variant: "typed", mutation });
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(schemaMutate).toHaveBeenCalledWith({ current: freshSlice, mutation });
  });
});
