import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../shared/lib/errors";
import { deleteSidebarView, fetchSidebarView, saveSidebarView } from "./api";
import { SAVE_DEBOUNCE_MS, SAVE_FALLBACK_MESSAGE } from "./lib";
import { DEFAULT_SIDEBAR_VIEW_STATE, type SidebarViewState } from "./types";

export { SAVE_DEBOUNCE_MS };

/**
 * Cross-mount stale-while-revalidate cache of the persisted view-state, keyed by
 * `projectId:viewKey`. Without it, navigating away and back remounts the hook at
 * `DEFAULT_SIDEBAR_VIEW_STATE` (alphabetical) and only flips to the saved manual
 * order once the GET resolves — a visible "load twice" flash. Seeding the first
 * render from this cache renders the saved order immediately; the background
 * fetch still runs and reconciles any change. In-memory only (per session/user);
 * a stale entry self-heals on the next revalidation.
 *
 * This is a deliberately small hand-rolled cache rather than TanStack Query
 * because the surrounding hook keeps a custom debounced/optimistic write path.
 * Tripwires: (a) the key is not user-scoped, so a user switch that bypasses
 * `clearSidebarViewStateCache` (session expiry / 401 redirect) can briefly show
 * the prior user's order until revalidation; (b) if a second module-level cache
 * like this ever appears, sign-out becomes a manual invalidation registry — move
 * the read path onto TanStack Query at that point instead of adding a third
 * `clearX()`.
 */
const viewStateCache = new Map<string, SidebarViewState>();

/**
 * Drop all cached sidebar view-state. Call on sign-out / user switch so a new
 * user never briefly sees the previous user's cached order before revalidation.
 * Also used by tests to isolate the module-level cache between cases.
 */
export function clearSidebarViewStateCache(): void {
  viewStateCache.clear();
}

/** The cached view-state for a scope, or undefined when disabled or not yet fetched. */
function cachedViewState(enabled: boolean, scopeKey: string): SidebarViewState | undefined {
  return enabled ? viewStateCache.get(scopeKey) : undefined;
}

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
  const scopeKey = `${projectId}:${viewKey}`;

  const [viewState, setViewStateInternal] = useState<SidebarViewState>(
    () => cachedViewState(enabled, scopeKey) ?? DEFAULT_SIDEBAR_VIEW_STATE,
  );
  // Only "loading" when there's nothing cached to show; a cache hit revalidates
  // silently so navigate-back never flashes the default order.
  const [isLoading, setIsLoading] = useState<boolean>(
    cachedViewState(enabled, scopeKey) === undefined && enabled,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

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

    // Seed from the cache (stale-while-revalidate): a hit renders immediately and
    // only revalidates; a miss shows the default under a loading flag until the GET.
    const cached = cachedViewState(enabled, scopeKey);
    setViewStateInternal(cached ?? DEFAULT_SIDEBAR_VIEW_STATE);
    setIsLoading(cached === undefined);
    setSaveError(null);

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchSidebarView(projectId, viewKey, controller.signal);
        if (cancelled || scopeKeyRef.current !== scopeKey) return;
        // Cache the resolved state (the default when nothing is saved yet) so the
        // next mount for this scope renders without a fetch and without a flash.
        const resolved = response.view_state ?? DEFAULT_SIDEBAR_VIEW_STATE;
        viewStateCache.set(scopeKey, resolved);
        setViewStateInternal(resolved);
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
      // Keep the cache in step with optimistic local edits so navigate-back shows
      // the just-made change immediately (the debounced save persists it).
      viewStateCache.set(scopeKeyRef.current, next);
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
    viewStateCache.delete(scopeKeyRef.current);
    // DELETE rather than PUT-with-defaults so defaults rebuild from code on the
    // next load and reset never freezes today's defaults into the saved row.
    void deleteSidebarView(projectId, viewKey).catch((error) => {
      setSaveError(errorMessage(error, SAVE_FALLBACK_MESSAGE));
    });
  }, [clearDebounce, enabled, projectId, viewKey]);

  return { viewState, setViewState, isLoading, reset, saveError };
}
