import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DataTableColumnDef, FieldDef, ViewState } from "../../../shared/ui/data-table";
import { emptyViewState } from "../../../shared/ui/data-table";
import { useLocalTableViewState } from "../useLocalTableViewState";

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

const USER_ID = "user_1";
const TABLE_KEY = "catalog_materials";
const STORAGE_KEY = `phn:tableView:v1:${USER_ID}:${TABLE_KEY}`;
const DEFAULT_FINGERPRINT = "fp-active";
const SHORT_DEBOUNCE_MS = 10;

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  return { ...emptyViewState(), ...overrides };
}

function renderHarness(
  initial: {
    userId?: string;
    tableKey?: string;
    enabled?: boolean;
    schemaFingerprint?: string;
    defaults?: ViewState;
  } = {},
) {
  return renderHook(
    (props: { userId: string; tableKey: string; enabled: boolean; schemaFingerprint: string }) =>
      useLocalTableViewState({
        userId: props.userId,
        tableKey: props.tableKey,
        defaults: initial.defaults ?? emptyViewState(),
        enabled: props.enabled,
        columns,
        fieldDefs,
        schemaFingerprint: props.schemaFingerprint,
        debounceMs: SHORT_DEBOUNCE_MS,
      }),
    {
      initialProps: {
        userId: initial.userId ?? USER_ID,
        tableKey: initial.tableKey ?? TABLE_KEY,
        enabled: initial.enabled ?? true,
        schemaFingerprint: initial.schemaFingerprint ?? DEFAULT_FINGERPRINT,
      },
    },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("useLocalTableViewState", () => {
  test("loads stored view synchronously on mount (no default flash)", () => {
    const stored: ViewState = makeViewState({
      sort: [{ fieldKey: "name", direction: "asc" }],
    });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schema_fingerprint: DEFAULT_FINGERPRINT, view_state: stored }),
    );

    const { result } = renderHarness();

    expect(result.current.view.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);
    expect(result.current.isLoading).toBe(false);
  });

  test("falls back to defaults when no stored envelope exists", () => {
    const { result } = renderHarness();
    expect(result.current.view).toEqual(emptyViewState());
  });

  test("debounces writes and persists the latest view under the active fingerprint", () => {
    const { result } = renderHarness();

    act(() => {
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      );
    });
    act(() => {
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      );
    });

    // Before the debounce fires nothing is written.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(SHORT_DEBOUNCE_MS);
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const envelope = JSON.parse(raw as string);
    expect(envelope.schema_fingerprint).toBe(DEFAULT_FINGERPRINT);
    expect(envelope.view_state.sort).toEqual([{ fieldKey: "name", direction: "desc" }]);
  });

  test("reset clears in-memory view and removes the storage key", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      }),
    );

    const { result } = renderHarness();

    act(() => {
      result.current.reset();
    });

    expect(result.current.view).toEqual(emptyViewState());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("scope-key change (different user) reloads from that user's storage", () => {
    const OTHER_USER = "user_2";
    const OTHER_KEY = `phn:tableView:v1:${OTHER_USER}:${TABLE_KEY}`;
    window.localStorage.setItem(
      OTHER_KEY,
      JSON.stringify({
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      }),
    );

    const { result, rerender } = renderHarness();

    // First user has no stored view → starts on defaults.
    expect(result.current.view.sort).toEqual([]);

    rerender({
      userId: OTHER_USER,
      tableKey: TABLE_KEY,
      enabled: true,
      schemaFingerprint: DEFAULT_FINGERPRINT,
    });

    expect(result.current.view.sort).toEqual([{ fieldKey: "name", direction: "desc" }]);
  });

  test("mismatched-fingerprint load applies for render and adopts the active fingerprint on next write", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema_fingerprint: "fp-old",
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      }),
    );

    const { result } = renderHarness();

    // Render uses the stored view even though fingerprints differ.
    expect(result.current.view.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);

    // Next user gesture re-saves under the *active* fingerprint.
    act(() => {
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(SHORT_DEBOUNCE_MS);
    });

    const envelope = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(envelope.schema_fingerprint).toBe(DEFAULT_FINGERPRINT);
    expect(envelope.view_state.sort).toEqual([{ fieldKey: "name", direction: "desc" }]);
  });

  test("sanitize drops view-state references to columns that no longer exist", () => {
    // Stored view sorts on a column the current schema doesn't have.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({
          sort: [
            { fieldKey: "name", direction: "asc" },
            { fieldKey: "removed_field", direction: "desc" },
          ],
        }),
      }),
    );

    const { result } = renderHarness();

    // sanitizeViewStateForSchema strips the unknown field for render.
    expect(result.current.view.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);
  });

  test("malformed JSON in storage is ignored and the key is cleared", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json");

    const { result } = renderHarness();

    expect(result.current.view).toEqual(emptyViewState());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("disabled=false skips storage I/O entirely", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schema_fingerprint: DEFAULT_FINGERPRINT,
        view_state: makeViewState({ sort: [{ fieldKey: "name", direction: "asc" }] }),
      }),
    );

    const { result } = renderHarness({ enabled: false });

    // Stored view is not consulted when disabled.
    expect(result.current.view).toEqual(emptyViewState());

    act(() => {
      result.current.onViewChange(
        makeViewState({ sort: [{ fieldKey: "name", direction: "desc" }] }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(SHORT_DEBOUNCE_MS);
    });

    // Storage still holds the original payload — disabled never writes.
    const envelope = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(envelope.view_state.sort).toEqual([{ fieldKey: "name", direction: "asc" }]);
  });
});
