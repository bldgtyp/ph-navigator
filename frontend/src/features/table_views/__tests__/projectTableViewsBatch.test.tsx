import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DataTableColumnDef, FieldDef, ViewState } from "../../../shared/ui/data-table";
import { emptyViewState } from "../../../shared/ui/data-table";

vi.mock("../api", () => ({
  fetchTableView: vi.fn(),
  fetchTableViews: vi.fn(),
  saveTableView: vi.fn(),
  deleteTableView: vi.fn(),
}));

// Imported after the mock so the provider + hook capture the mocked functions.
import * as api from "../api";
import {
  ProjectTableViewsBatchProvider,
  useProjectTableViewsBatchValue,
} from "../batchContext";
import { useProjectTableViewState } from "../hooks";
import type { TableViewResponse } from "../types";

const fetchTableViewMock = api.fetchTableView as ReturnType<typeof vi.fn>;
const fetchTableViewsMock = api.fetchTableViews as ReturnType<typeof vi.fn>;
const saveTableViewMock = api.saveTableView as ReturnType<typeof vi.fn>;
const deleteTableViewMock = api.deleteTableView as ReturnType<typeof vi.fn>;

type Row = { id: string; name: string };

const fieldDefs: FieldDef[] = [{ field_key: "name", field_type: "text", display_name: "Name" }];
const columns: DataTableColumnDef<unknown>[] = [
  { id: "col-name", fieldKey: "name", header: "Name", accessor: (row) => (row as Row).name },
];

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const FINGERPRINT = "fp-active";

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  return { ...emptyViewState(), ...overrides };
}

function tableViewResponse(view: ViewState | null): TableViewResponse {
  return {
    view_state_schema_version: 1,
    view_state: view ? { schema_fingerprint: FINGERPRINT, view_state: view } : null,
    updated_at: view ? "2026-05-24T00:00:00Z" : null,
  };
}

function batchWrapper(keys: string[], enabled = true) {
  return ({ children }: { children: ReactNode }) => {
    const value = useProjectTableViewsBatchValue({
      projectId: PROJECT_ID,
      tableKeys: keys,
      enabled,
    });
    return createElement(ProjectTableViewsBatchProvider, { value }, children);
  };
}

function renderTableView(tableKey: string, wrapper?: ReturnType<typeof batchWrapper>) {
  return renderHook(
    () =>
      useProjectTableViewState({
        projectId: PROJECT_ID,
        tableKey,
        defaults: emptyViewState(),
        enabled: true,
        columns,
        fieldDefs,
        schemaFingerprint: FINGERPRINT,
        debounceMs: 20,
      }),
    wrapper ? { wrapper } : undefined,
  );
}

beforeEach(() => {
  fetchTableViewMock.mockReset();
  fetchTableViewsMock.mockReset();
  saveTableViewMock.mockReset();
  deleteTableViewMock.mockReset();
  fetchTableViewMock.mockResolvedValue(tableViewResponse(null));
  fetchTableViewsMock.mockResolvedValue({});
  saveTableViewMock.mockResolvedValue(tableViewResponse(null));
  deleteTableViewMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("table-views batch read-through", () => {
  test("a covered key seeds from the batch and issues no per-table GET", async () => {
    const saved = makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] });
    fetchTableViewsMock.mockResolvedValue({ pumps: tableViewResponse(saved) });

    const { result } = renderTableView("pumps", batchWrapper(["pumps"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.view.sort).toEqual(saved.sort);
    expect(fetchTableViewsMock).toHaveBeenCalledTimes(1);
    expect(fetchTableViewMock).not.toHaveBeenCalled();
  });

  test("a covered key with no saved row stays at defaults without a GET", async () => {
    fetchTableViewsMock.mockResolvedValue({ pumps: tableViewResponse(null) });
    const defaults = makeViewState({ hiddenColumns: ["col-name"] });

    const { result } = renderHook(
      () =>
        useProjectTableViewState({
          projectId: PROJECT_ID,
          tableKey: "pumps",
          defaults,
          enabled: true,
          columns,
          fieldDefs,
          schemaFingerprint: FINGERPRINT,
          debounceMs: 20,
        }),
      { wrapper: batchWrapper(["pumps"]) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.view.hiddenColumns).toEqual(["col-name"]);
    expect(fetchTableViewMock).not.toHaveBeenCalled();
  });

  test("an un-covered key falls back to the per-table GET", async () => {
    // Provider batches only `pumps`; the hook for `fans` is not covered.
    fetchTableViewsMock.mockResolvedValue({ pumps: tableViewResponse(null) });
    const fansView = makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] });
    fetchTableViewMock.mockResolvedValue(tableViewResponse(fansView));

    const { result } = renderTableView("fans", batchWrapper(["pumps"]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchTableViewMock).toHaveBeenCalledTimes(1);
    expect(result.current.view.sort).toEqual(fansView.sort);
  });

  test("with no provider the hook keeps its per-table GET", async () => {
    const saved = makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] });
    fetchTableViewMock.mockResolvedValue(tableViewResponse(saved));

    const { result } = renderTableView("pumps");

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchTableViewsMock).not.toHaveBeenCalled();
    expect(fetchTableViewMock).toHaveBeenCalledTimes(1);
    expect(result.current.view.sort).toEqual(saved.sort);
  });

  test("a disabled (viewer) provider does not fetch the batch", async () => {
    const { result } = renderTableView("pumps", batchWrapper(["pumps"], false));

    // The hook still has enabled=true here, so with no batch coverage it GETs.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchTableViewsMock).not.toHaveBeenCalled();
    expect(fetchTableViewMock).toHaveBeenCalledTimes(1);
  });
});
