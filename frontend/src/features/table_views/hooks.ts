import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../../shared/lib/errors";
import { type DataTableColumnDef, type FieldDef, type ViewState } from "../../shared/ui/data-table";
import { deleteTableView, fetchTableView, saveTableView } from "./api";
import { useProjectTableViewsBatch } from "./batchContext";
import { SAVE_DEBOUNCE_MS, SAVE_FALLBACK_MESSAGE, sanitizeViewStateForSchema } from "./lib";

export { SAVE_DEBOUNCE_MS };

export type UseProjectTableViewStateArgs = {
  projectId: string;
  tableKey: string;
  defaults: ViewState;
  enabled: boolean;
  columns: DataTableColumnDef<unknown>[];
  fieldDefs: FieldDef[];
  // Plan-14 P1.5 / D13: the active table's schema fingerprint (from
  // `useTableSchema`). Persisted view-state records carry this beside
  // their inner state; loading a record under a different fingerprint
  // applies it for render but does not overwrite the saved record
  // until the user changes view state under the active schema.
  schemaFingerprint: string;
  debounceMs?: number;
};

export type UseProjectTableViewStateResult = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  isLoading: boolean;
  reset: () => void;
  saveError: string | null;
};

export function useProjectTableViewState({
  projectId,
  tableKey,
  defaults,
  enabled,
  columns,
  fieldDefs,
  schemaFingerprint,
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

  // Page-scoped batch read-through. `batchCovered` / `batchReady` are the only
  // batch signals the load effect depends on; the batch object itself is held
  // in a ref so a later `prime` / `drop` (after a save/reset) refreshes the
  // shared cache without re-running the load effect on the live hook.
  const batch = useProjectTableViewsBatch();
  const batchRef = useRef(batch);
  batchRef.current = batch;
  const batchCovered = batch.active && batch.has(tableKey);
  // Single load-effect trigger: stays "off" (constant) for an un-covered key so
  // the batch settling never re-runs the per-table GET, and transitions
  // "pending" → "ready" for a covered key so the seed lands once it arrives.
  const batchGate = batchCovered ? (batch.ready ? "ready" : "pending") : "off";

  const renderSafeView = useMemo(
    () => sanitizeViewStateForSchema(view, fieldDefs, columns),
    [view, fieldDefs, columns],
  );

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Always save with the *active* fingerprint so loads under a
  // mismatched fingerprint that the user then edits adopt the active
  // schema's identity on the next persisted write.
  const fingerprintRef = useRef(schemaFingerprint);
  useEffect(() => {
    fingerprintRef.current = schemaFingerprint;
  }, [schemaFingerprint]);

  const flushSave = useCallback(
    async (next: ViewState, scope: string) => {
      if (inFlightRef.current) {
        pendingViewRef.current = next;
        return;
      }
      inFlightRef.current = true;
      try {
        const saved = await saveTableView(projectId, tableKey, {
          schema_fingerprint: fingerprintRef.current,
          view_state: next,
        });
        setSaveError(null);
        // Keep the shared batch cache in step so a remount reads the saved
        // value, not a stale seed. No-op when no provider is mounted.
        batchRef.current.prime(tableKey, saved);
      } catch (error) {
        if (scopeKeyRef.current === scope) {
          setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
        }
      } finally {
        inFlightRef.current = false;
        const queued = pendingViewRef.current;
        pendingViewRef.current = null;
        if (queued !== null && scopeKeyRef.current === scope) {
          void flushSave(queued, scope);
        }
      }
    },
    [projectId, tableKey],
  );

  // Load gate avoids the "default flash" — render skeleton until GET settles.
  useEffect(() => {
    scopeKeyRef.current = scopeKey;
    clearDebounce();
    pendingViewRef.current = null;

    if (!enabled) {
      setView(defaults);
      setIsLoading(false);
      setSaveError(null);
      return;
    }

    // Read-through: when a page-scoped batch covers this table, seed from it
    // (or wait for it to settle) instead of issuing a per-table GET.
    if (batchCovered) {
      if (batchGate !== "ready") {
        // Batch still in flight — hold the load gate; this effect re-runs when
        // `batchReady` flips, at which point we seed below.
        setIsLoading(true);
        setView(defaults);
        setSaveError(null);
        return;
      }
      const seeded = batchRef.current.get(tableKey);
      if (seeded !== undefined) {
        setView(seeded.view_state ? seeded.view_state.view_state : defaults);
        setIsLoading(false);
        setSaveError(null);
        return;
      }
      // Batch settled without an entry for this key (it failed) — fall through
      // to the per-table GET below.
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
        // D13: the stored envelope's `view_state` is the user's view;
        // its `schema_fingerprint` is informational here — the hook
        // re-saves under the active fingerprint on the next user
        // gesture, which means a mismatched-fingerprint load is
        // applied for render but never silently overwrites.
        if (response.view_state) {
          setView(response.view_state.view_state);
        }
      } catch (error) {
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
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
    // for the lifetime of one (projectId, tableKey) scope. `batchRef` is read
    // lazily so cache mutations (prime/drop) don't re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tableKey, enabled, scopeKey, clearDebounce, batchCovered, batchGate]);

  useEffect(() => clearDebounce, [clearDebounce]);

  const onViewChange = useCallback(
    (next: ViewState) => {
      setView((current) => (current === next ? current : next));
      if (!enabled) return;
      clearDebounce();
      const scope = scopeKeyRef.current;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void flushSave(next, scope);
      }, debounceMs);
    },
    [clearDebounce, debounceMs, enabled, flushSave],
  );

  const reset = useCallback(() => {
    clearDebounce();
    pendingViewRef.current = null;
    setView(defaults);
    setSaveError(null);
    if (!enabled) return;
    // DELETE rather than PUT-with-defaults: defaults rebuild from code
    // on next load, so reset never freezes today's defaults into the
    // saved row.
    void deleteTableView(projectId, tableKey)
      .then(() => {
        // Drop the shared cache entry so a remount re-reads the now
        // default-empty state via the per-table fallback rather than the
        // pre-reset seed. No-op when no provider is mounted.
        batchRef.current.drop(tableKey);
      })
      .catch((error) => {
        setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
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
