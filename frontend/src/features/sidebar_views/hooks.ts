import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../shared/lib/errors";
import { deleteSidebarView, fetchSidebarView, saveSidebarView } from "./api";
import { SAVE_DEBOUNCE_MS, SAVE_FALLBACK_MESSAGE } from "./lib";
import { DEFAULT_SIDEBAR_VIEW_STATE, type SidebarViewState } from "./types";

export { SAVE_DEBOUNCE_MS };

export type UseProjectSidebarViewStateArgs = {
  projectId: string;
  /** Sidebar identity, e.g. `"apertures"` / `"assemblies"`. */
  viewKey: string;
  /** Gate persistence to editors — viewers get in-memory defaults, no I/O. */
  enabled: boolean;
  debounceMs?: number;
};

export type UseProjectSidebarViewStateResult = {
  viewState: SidebarViewState;
  setViewState: (next: SidebarViewState) => void;
  isLoading: boolean;
  reset: () => void;
  saveError: string | null;
};

/**
 * Loads and debounced-saves a user's per-project sidebar organization state.
 * A trimmed sibling of `useProjectTableViewState` (no page-batch read-through
 * and no schema fingerprint — one sidebar mounts per page and the payload has
 * no column schema). Single-flight coalescing keeps a burst of toggles to one
 * trailing save; a scope guard discards responses for a stale
 * `(projectId, viewKey)`.
 */
export function useProjectSidebarViewState({
  projectId,
  viewKey,
  enabled,
  debounceMs = SAVE_DEBOUNCE_MS,
}: UseProjectSidebarViewStateArgs): UseProjectSidebarViewStateResult {
  const [viewState, setViewStateInternal] = useState<SidebarViewState>(DEFAULT_SIDEBAR_VIEW_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scopeKey = `${projectId}:${viewKey}`;
  const scopeKeyRef = useRef(scopeKey);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const pendingViewRef = useRef<SidebarViewState | null>(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(
    async (next: SidebarViewState, scope: string) => {
      if (inFlightRef.current) {
        pendingViewRef.current = next;
        return;
      }
      inFlightRef.current = true;
      try {
        await saveSidebarView(projectId, viewKey, next);
        if (scopeKeyRef.current === scope) setSaveError(null);
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
    [projectId, viewKey],
  );

  // Load gate avoids the "default flash" — hold isLoading until the GET settles.
  useEffect(() => {
    scopeKeyRef.current = scopeKey;
    clearDebounce();
    pendingViewRef.current = null;

    if (!enabled) {
      setViewStateInternal(DEFAULT_SIDEBAR_VIEW_STATE);
      setIsLoading(false);
      setSaveError(null);
      return;
    }

    setIsLoading(true);
    setViewStateInternal(DEFAULT_SIDEBAR_VIEW_STATE);
    setSaveError(null);

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchSidebarView(projectId, viewKey, controller.signal);
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        if (response.view_state) setViewStateInternal(response.view_state);
      } catch (error) {
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
      } finally {
        if (!cancelled && scopeKeyRef.current === scopeKey) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, viewKey, enabled, scopeKey, clearDebounce]);

  useEffect(() => clearDebounce, [clearDebounce]);

  const setViewState = useCallback(
    (next: SidebarViewState) => {
      setViewStateInternal(next);
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
    setViewStateInternal(DEFAULT_SIDEBAR_VIEW_STATE);
    setSaveError(null);
    if (!enabled) return;
    // DELETE rather than PUT-with-defaults so defaults rebuild from code on the
    // next load and reset never freezes today's defaults into the saved row.
    void deleteSidebarView(projectId, viewKey).catch((error) => {
      setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
    });
  }, [clearDebounce, enabled, projectId, viewKey]);

  return { viewState, setViewState, isLoading, reset, saveError };
}
