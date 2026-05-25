import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DataTableColumnDef, FieldDef, ViewState } from "../../../shared/ui/data-table";
import { emptyViewState } from "../../../shared/ui/data-table";

vi.mock("../api", () => ({
  fetchTableView: vi.fn(),
  saveTableView: vi.fn(),
  deleteTableView: vi.fn(),
}));

// Imported after the mock so the hook captures the mocked functions.
import * as api from "../api";
import { useProjectTableViewState } from "../useProjectTableViewState";

const fetchTableViewMock = api.fetchTableView as ReturnType<typeof vi.fn>;
const saveTableViewMock = api.saveTableView as ReturnType<typeof vi.fn>;
const deleteTableViewMock = api.deleteTableView as ReturnType<typeof vi.fn>;

type Row = { id: string; name: string; floor: string | null };

const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [{ id: "opt_first", label: "1st", color: "#10b981", order: 0 }],
  },
];

const columns: DataTableColumnDef<unknown>[] = [
  {
    id: "col-name",
    fieldKey: "name",
    header: "Name",
    accessor: (row) => (row as Row).name,
  },
  {
    id: "col-floor",
    fieldKey: "floor",
    header: "Floor",
    accessor: (row) => (row as Row).floor,
  },
];

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const TABLE_KEY = "rooms";

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  return { ...emptyViewState(), ...overrides };
}

const DEFAULT_FINGERPRINT = "fp-active";

function renderHarness(
  args: {
    enabled?: boolean;
    defaults?: ViewState;
    debounceMs?: number;
    projectId?: string;
    schemaFingerprint?: string;
  } = {},
) {
  return renderHook(
    (props: { projectId: string; enabled: boolean; schemaFingerprint: string }) =>
      useProjectTableViewState({
        projectId: props.projectId,
        tableKey: TABLE_KEY,
        defaults: args.defaults ?? emptyViewState(),
        enabled: props.enabled,
        columns,
        fieldDefs,
        schemaFingerprint: props.schemaFingerprint,
        debounceMs: args.debounceMs ?? 50,
      }),
    {
      initialProps: {
        projectId: args.projectId ?? PROJECT_ID,
        enabled: args.enabled ?? true,
        schemaFingerprint: args.schemaFingerprint ?? DEFAULT_FINGERPRINT,
      },
    },
  );
}

beforeEach(() => {
  fetchTableViewMock.mockReset();
  saveTableViewMock.mockReset();
  deleteTableViewMock.mockReset();
  saveTableViewMock.mockResolvedValue({
    view_state_schema_version: 1,
    view_state: null,
    updated_at: "2026-05-24T00:00:00Z",
  });
  deleteTableViewMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useProjectTableViewState", () => {
  test("disabled hook never calls GET/PUT/DELETE and reports loaded immediately", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const { result } = renderHarness({ enabled: false });

    expect(result.current.isLoading).toBe(false);
    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fetchTableViewMock).not.toHaveBeenCalled();
    expect(saveTableViewMock).not.toHaveBeenCalled();
    expect(deleteTableViewMock).not.toHaveBeenCalled();
  });

  test("enabled hook renders loading until GET settles then applies saved view", async () => {
    let resolveFetch: (value: unknown) => void = () => undefined;
    fetchTableViewMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const saved = makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] });
    const { result } = renderHarness();
    expect(result.current.isLoading).toBe(true);

    act(() =>
      resolveFetch({
        view_state_schema_version: 1,
        view_state: { schema_fingerprint: DEFAULT_FINGERPRINT, view_state: saved },
        updated_at: "2026-05-24T00:00:00Z",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.view.sort).toEqual(saved.sort);
  });

  test("missing saved row leaves the view at defaults", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const defaults = makeViewState({ hiddenColumns: ["col-name"] });
    const { result } = renderHarness({ defaults });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.view.hiddenColumns).toEqual(["col-name"]);
  });

  test("rapid onViewChange calls collapse to one PUT with the final state", async () => {
    vi.useFakeTimers();
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const { result } = renderHarness({ debounceMs: 100 });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      ),
    );
    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      ),
    );
    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "floor", direction: "asc" }] }),
      ),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(saveTableViewMock).toHaveBeenCalledTimes(1);
    const [, , savedEnvelope] = saveTableViewMock.mock.calls[0]!;
    expect((savedEnvelope as { view_state: ViewState }).view_state.sort).toEqual([
      { fieldKey: "floor", direction: "asc" },
    ]);
    expect((savedEnvelope as { schema_fingerprint: string }).schema_fingerprint).toBe(
      DEFAULT_FINGERPRINT,
    );
  });

  test("newer view that arrives during in-flight PUT flushes after settle", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: null,
      updated_at: null,
    });
    const completions: ((value: unknown) => void)[] = [];
    saveTableViewMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          completions.push(resolve);
        }),
    );

    const { result } = renderHarness({ debounceMs: 10 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      ),
    );
    await waitFor(() => expect(saveTableViewMock).toHaveBeenCalledTimes(1));

    // Newer change arrives mid-flight: should queue, not race.
    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(saveTableViewMock).toHaveBeenCalledTimes(1);

    // Resolve the first save — the queued newer state should flush.
    act(() => completions[0]?.({}));
    await waitFor(() => expect(saveTableViewMock).toHaveBeenCalledTimes(2));
    const [, , secondEnvelope] = saveTableViewMock.mock.calls[1]!;
    expect((secondEnvelope as { view_state: ViewState }).view_state.sort).toEqual([
      { fieldKey: "name", direction: "desc" },
    ]);
  });

  test("reset cancels pending save and fires DELETE", async () => {
    vi.useFakeTimers();
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: {
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      },
      updated_at: "2026-05-24T00:00:00Z",
    });
    const { result } = renderHarness({ debounceMs: 100 });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      ),
    );
    await act(async () => {
      result.current.reset();
    });

    // Advance past the debounce: the pending save must NOT fire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(saveTableViewMock).not.toHaveBeenCalled();
    expect(deleteTableViewMock).toHaveBeenCalledWith(PROJECT_ID, TABLE_KEY);
    expect(result.current.view.sort).toEqual([]);
  });

  test("stale GET response after scope switch is ignored", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    let resolveSecond: (value: unknown) => void = () => undefined;
    fetchTableViewMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fetchTableViewMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
    );

    const { result, rerender } = renderHarness();
    rerender({
      projectId: "00000000-0000-0000-0000-000000000002",
      enabled: true,
      schemaFingerprint: DEFAULT_FINGERPRINT,
    });

    // Now resolve the FIRST (stale) GET with a different saved view.
    act(() =>
      resolveFirst({
        view_state_schema_version: 1,
        view_state: {
          schema_fingerprint: DEFAULT_FINGERPRINT,
          view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
        },
        updated_at: "2026-05-24T00:00:00Z",
      }),
    );
    // Resolve the SECOND (current) GET with empty state.
    act(() =>
      resolveSecond({
        view_state_schema_version: 1,
        view_state: null,
        updated_at: null,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.view.sort).toEqual([]);
  });

  test("sanitized load does not auto-save when no user change occurred", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: {
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({
          sort: [{ fieldKey: "deleted_field", direction: "asc" }],
        }),
      },
      updated_at: "2026-05-24T00:00:00Z",
    });
    const { result } = renderHarness({ debounceMs: 30 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Render-safe view should drop the stale ref…
    expect(result.current.view.sort).toEqual([]);
    // …but no auto-save should occur.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(saveTableViewMock).not.toHaveBeenCalled();
  });

  // Plan-14 P1.5 / D13: switching to a version with a different schema
  // fingerprint applies the stored state for render but must not
  // overwrite the saved record until the user changes view state under
  // the active fingerprint.
  test("loading with a mismatched fingerprint renders state without saving", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: {
        schema_fingerprint: "fp-other-version",
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      },
      updated_at: "2026-05-24T00:00:00Z",
    });
    const { result } = renderHarness({ debounceMs: 30 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.view.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(saveTableViewMock).not.toHaveBeenCalled();
  });

  test("first user gesture after mismatched load saves under the active fingerprint", async () => {
    fetchTableViewMock.mockResolvedValue({
      view_state_schema_version: 1,
      view_state: {
        schema_fingerprint: "fp-other-version",
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      },
      updated_at: "2026-05-24T00:00:00Z",
    });
    const { result } = renderHarness({ debounceMs: 20 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() =>
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      ),
    );
    await waitFor(() => expect(saveTableViewMock).toHaveBeenCalledTimes(1));
    const [, , savedEnvelope] = saveTableViewMock.mock.calls[0]!;
    expect((savedEnvelope as { schema_fingerprint: string }).schema_fingerprint).toBe(
      DEFAULT_FINGERPRINT,
    );
    expect((savedEnvelope as { view_state: ViewState }).view_state.sort).toEqual([
      { fieldKey: "name", direction: "desc" },
    ]);
  });
});
