import { useCallback, useEffect, useRef, useState } from "react";
import {
  sanitizeViewStateForSchema,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
} from "../../shared/ui/data-table";
import { deleteTableView, fetchTableView, saveTableView } from "./api";

export const SAVE_DEBOUNCE_MS = 500;

export type UseProjectTableViewStateArgs = {
  projectId: string;
  tableKey: string;
  defaults: ViewState;
  enabled: boolean;
  columns: DataTableColumnDef<unknown>[];
  fieldDefs: FieldDef[];
  debounceMs?: number;
};

export type UseProjectTableViewStateResult = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  isLoading: boolean;
  reset: () => void;
  saveError: string | null;
};

// Plan 09 §4.4. Owns the controlled `view` value the parent passes into
// <DataTable>, plus the load gate, the 500ms debounced save with a
// single in-flight + latest-pending queue, and DELETE-on-reset. The
// sanitization step is pure and render-safe — see `sanitizeViewStateForSchema`.
export function useProjectTableViewState({
  projectId,
  tableKey,
  defaults,
  enabled,
  columns,
  fieldDefs,
  debounceMs = SAVE_DEBOUNCE_MS,
}: UseProjectTableViewStateArgs): UseProjectTableViewStateResult {
  const [view, setView] = useState<ViewState>(defaults);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scopeKey = `${projectId}:${tableKey}`;
  const scopeKeyRef = useRef(scopeKey);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingViewRef = useRef<ViewState | null>(null);
  const userTouchedRef = useRef(false);

  // Sanitize against current schema for render. Pure helper; safe to
  // call on every render — output identity changes only when refs do.
  const renderSafeView = sanitizeViewStateForSchema(view, fieldDefs, columns);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(
    async (next: ViewState, scope: string) => {
      if (inFlightRef.current) {
        pendingViewRef.current = next;
        return;
      }
      inFlightRef.current = true;
      try {
        await saveTableView(projectId, tableKey, next);
        setSaveError(null);
      } catch (error) {
        // Drop stale results from older scopes.
        if (scopeKeyRef.current === scope) {
          setSaveError(error instanceof Error ? error.message : "View persistence unavailable.");
        }
      } finally {
        inFlightRef.current = false;
        const queued = pendingViewRef.current;
        pendingViewRef.current = null;
        if (queued !== null && scopeKeyRef.current === scope) {
          // Newer view arrived while saving — flush it now.
          void flushSave(queued, scope);
        }
      }
    },
    [projectId, tableKey],
  );

  // Load gate. Resets render to defaults until the GET resolves to
  // avoid the "default flash" hazard from §2 rule 8.
  useEffect(() => {
    scopeKeyRef.current = scopeKey;
    clearDebounce();
    pendingViewRef.current = null;
    userTouchedRef.current = false;

    if (!enabled) {
      setView(defaults);
      setIsLoading(false);
      setSaveError(null);
      return;
    }

    setIsLoading(true);
    setView(defaults);
    setSaveError(null);

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchTableView(projectId, tableKey, controller.signal);
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        if (response.view_state) {
          setView(response.view_state);
        }
      } catch (error) {
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveError(error instanceof Error ? error.message : "View persistence unavailable.");
      } finally {
        if (!cancelled && scopeKeyRef.current === scopeKey) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `defaults` identity is owned by the consumer; treat it as stable
    // for the lifetime of one (projectId, tableKey) scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tableKey, enabled, scopeKey, clearDebounce]);

  // Cleanup on unmount.
  useEffect(() => clearDebounce, [clearDebounce]);

  const onViewChange = useCallback(
    (next: ViewState) => {
      setView(next);
      if (!enabled) return;
      userTouchedRef.current = true;
      clearDebounce();
      const scope = scopeKeyRef.current;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        // Send the latest view at fire time, not the captured `next`,
        // so coalesced changes always ship the most recent value.
        void flushSave(next, scope);
      }, debounceMs);
    },
    [clearDebounce, debounceMs, enabled, flushSave],
  );

  const reset = useCallback(() => {
    clearDebounce();
    pendingViewRef.current = null;
    userTouchedRef.current = false;
    setView(defaults);
    setSaveError(null);
    if (!enabled) return;
    // Fire-and-forget DELETE. Defaults rebuild from code on next load
    // so reset never freezes today's defaults into the saved row.
    void deleteTableView(projectId, tableKey).catch((error) => {
      setSaveError(error instanceof Error ? error.message : "View persistence unavailable.");
    });
  }, [clearDebounce, defaults, enabled, projectId, tableKey]);

  return {
    view: renderSafeView,
    onViewChange,
    isLoading,
    reset,
    saveError,
  };
}
