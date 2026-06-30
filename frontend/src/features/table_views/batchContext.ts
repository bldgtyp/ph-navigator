// Page-scoped batch read for table view-state.
//
// A page that mounts N tables (e.g. equipment's 7 sub-tables) builds a batch
// value with `useProjectTableViewsBatchValue` and wraps its body in
// `ProjectTableViewsBatchProvider`. The provider fetches all N view configs in
// ONE request; each per-table `useProjectTableViewState` then reads its config
// from this shared result via `useProjectTableViewsBatch` instead of issuing
// its own GET.
//
// The contract is deliberately boolean-first (`active` / `ready` / `has`) so a
// `prime` / `drop` after a save mutates the cached map WITHOUT changing the
// signals the per-table load effect depends on — live editing is never
// disturbed; the refreshed entry is only read on a later remount.
//
// (Provider value + reader hook live in one `.ts` module, mirroring
// `apertures/hooks/useDriftContext.ts`: the raw `Context.Provider` is exported
// and the stateful value is produced by a hook at the call site.)

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchTableViews } from "./api";
import type { TableViewResponse } from "./types";

export type ProjectTableViewsBatch = {
  // A provider is mounted AND will fetch (editor with a non-empty key set).
  // When false, consumers behave exactly as they did before batching.
  active: boolean;
  // The batch request has settled (resolved or failed). While false and the
  // key is covered, consumers wait rather than firing a per-table GET.
  ready: boolean;
  // Is this `table_key` part of the batched set for the mounted page?
  has: (tableKey: string) => boolean;
  // The settled response for a covered key, or undefined (not yet ready, or
  // the batch failed for this key → consumer falls back to a per-table GET).
  get: (tableKey: string) => TableViewResponse | undefined;
  // Refresh the cached entry after a save so a later remount reads it fresh.
  prime: (tableKey: string, response: TableViewResponse) => void;
  // Forget the cached entry after a reset/delete so a remount re-reads the
  // (now default-empty) state via the per-table fallback.
  drop: (tableKey: string) => void;
};

const NOOP_BATCH: ProjectTableViewsBatch = {
  active: false,
  ready: false,
  has: () => false,
  get: () => undefined,
  prime: () => undefined,
  drop: () => undefined,
};

const ProjectTableViewsBatchContext = createContext<ProjectTableViewsBatch>(NOOP_BATCH);

export const ProjectTableViewsBatchProvider = ProjectTableViewsBatchContext.Provider;

// Returns the surrounding batch, or an inert no-op batch when no provider is
// mounted — so a table rendered outside a batched page keeps its per-table GET.
export function useProjectTableViewsBatch(): ProjectTableViewsBatch {
  return useContext(ProjectTableViewsBatchContext);
}

// Builds the batch value the page feeds into `ProjectTableViewsBatchProvider`.
// `enabled` gates the fetch (e.g. editor-only); a viewer page passes false and
// the value stays inert, matching the per-table hooks which also no-op.
export function useProjectTableViewsBatchValue({
  projectId,
  tableKeys,
  enabled,
}: {
  projectId: string;
  tableKeys: string[];
  enabled: boolean;
}): ProjectTableViewsBatch {
  const [views, setViews] = useState<Record<string, TableViewResponse>>({});
  const [ready, setReady] = useState(false);

  // Collapse the key set to a stable, order-independent, de-duplicated string
  // so the fetch effect re-runs only when the set actually changes. Table keys
  // match `^[a-z][a-z0-9_]*$`, so they never contain the comma separator.
  const keysKey = useMemo(() => [...new Set(tableKeys)].sort().join(","), [tableKeys]);
  const requestKeys = useMemo(() => (keysKey ? keysKey.split(",") : []), [keysKey]);
  const requestedKeys = useMemo(() => new Set(requestKeys), [requestKeys]);

  useEffect(() => {
    if (!enabled || requestKeys.length === 0) {
      setViews({});
      setReady(false);
      return;
    }

    setReady(false);
    setViews({});
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchTableViews(projectId, requestKeys, controller.signal);
        if (!cancelled) setViews(result);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Leave the map empty; covered consumers fall back to per-table GETs.
        setViews({});
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, enabled, keysKey, requestKeys]);

  const has = useCallback((tableKey: string) => requestedKeys.has(tableKey), [requestedKeys]);
  const get = useCallback((tableKey: string) => views[tableKey], [views]);
  const prime = useCallback((tableKey: string, response: TableViewResponse) => {
    setViews((current) => ({ ...current, [tableKey]: response }));
  }, []);
  const drop = useCallback((tableKey: string) => {
    setViews((current) => {
      if (!(tableKey in current)) return current;
      const next = { ...current };
      delete next[tableKey];
      return next;
    });
  }, []);

  return useMemo<ProjectTableViewsBatch>(
    () => ({
      active: enabled && requestKeys.length > 0,
      ready,
      has,
      get,
      prime,
      drop,
    }),
    [enabled, requestKeys.length, ready, has, get, prime, drop],
  );
}
