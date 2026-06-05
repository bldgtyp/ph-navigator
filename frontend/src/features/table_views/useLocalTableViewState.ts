import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DataTableColumnDef, type FieldDef, type ViewState } from "../../shared/ui/data-table";
import { sanitizeViewStateForSchema } from "./lib";
import type { ViewStateEnvelope } from "./types";

// Versioned prefix so we can ship a one-shot migration later if the
// envelope shape changes without colliding with old payloads.
const STORAGE_PREFIX = "phn:tableView:v1";
const DEFAULT_SAVE_DEBOUNCE_MS = 150;

function storageKey(scopeKey: string): string {
  return `${STORAGE_PREFIX}:${scopeKey}`;
}

function readEnvelope(scopeKey: string): ViewStateEnvelope | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(scopeKey));
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "schema_fingerprint" in parsed &&
      typeof (parsed as { schema_fingerprint: unknown }).schema_fingerprint === "string" &&
      "view_state" in parsed &&
      typeof (parsed as { view_state: unknown }).view_state === "object" &&
      (parsed as { view_state: unknown }).view_state !== null
    ) {
      return parsed as ViewStateEnvelope;
    }
  } catch {
    // Fall through and clear the bad key below.
  }
  try {
    window.localStorage.removeItem(storageKey(scopeKey));
  } catch {
    // ignore — best-effort cleanup
  }
  return null;
}

function writeEnvelope(scopeKey: string, envelope: ViewStateEnvelope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scopeKey), JSON.stringify(envelope));
  } catch {
    // Quota exceeded, private window, or storage disabled: in-memory
    // state still works, just doesn't persist this session.
  }
}

function removeEnvelope(scopeKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(scopeKey));
  } catch {
    // ignore
  }
}

export type UseLocalTableViewStateArgs = {
  userId: string;
  tableKey: string;
  defaults: ViewState;
  enabled: boolean;
  columns: DataTableColumnDef<unknown>[];
  fieldDefs: FieldDef[];
  // Stored beside the user's view state so a later schema change can
  // detect mismatched-fingerprint loads. Render still applies the saved
  // view through `sanitizeViewStateForSchema`; the active fingerprint
  // overwrites the stored one on the next user gesture.
  schemaFingerprint: string;
  debounceMs?: number;
};

export type UseLocalTableViewStateResult = {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  // Always false here — localStorage reads synchronously in the state
  // initializer. Kept on the result type for API parity with
  // `useProjectTableViewState`, which gates a real network round-trip.
  isLoading: boolean;
  reset: () => void;
};

// Per-user view-state persistence for tables that aren't scoped to a
// project (catalogs). Same conceptual API as `useProjectTableViewState`
// but backed by `localStorage`. Storage key:
// `phn:tableView:v1:${userId}:${tableKey}`. Catalogs are shared across
// users, but sort / filter / group / column widths are a personal lens
// — keeping them in localStorage gives each user their own remembered
// view without server work.
export function useLocalTableViewState({
  userId,
  tableKey,
  defaults,
  enabled,
  columns,
  fieldDefs,
  schemaFingerprint,
  debounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
}: UseLocalTableViewStateArgs): UseLocalTableViewStateResult {
  const scopeKey = `${userId}:${tableKey}`;

  // Synchronous read in the initializer avoids a default-flash on
  // mount; no skeleton needed.
  const [view, setView] = useState<ViewState>(() => {
    if (!enabled) return defaults;
    const envelope = readEnvelope(scopeKey);
    return envelope?.view_state ?? defaults;
  });

  const scopeKeyRef = useRef(scopeKey);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the most-recent un-persisted view so unmount/scope-change can
  // flush it synchronously instead of dropping the edit.
  const pendingWriteRef = useRef<ViewState | null>(null);

  // Save under the *active* fingerprint so a mismatched-fingerprint
  // load that the user then edits adopts the active schema on the next
  // persisted write.
  const fingerprintRef = useRef(schemaFingerprint);
  useEffect(() => {
    fingerprintRef.current = schemaFingerprint;
  }, [schemaFingerprint]);

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

  // Flush a pending write to storage immediately. Used by unmount and
  // scope-change so a debounced edit isn't dropped by the next
  // clearDebounce(). Safe to call when nothing is pending.
  const flushPendingWrite = useCallback((scope: string) => {
    const pending = pendingWriteRef.current;
    if (pending === null) return;
    pendingWriteRef.current = null;
    writeEnvelope(scope, {
      schema_fingerprint: fingerprintRef.current,
      view_state: pending,
    });
  }, []);

  // Scope-key changes (sign in as a different user, or this hook
  // mounted under a new `tableKey`) reload from storage. The
  // first-mount run is a no-op because `scopeKeyRef.current` was
  // initialized with the current scopeKey — keeping the implicit
  // first-mount guard explicit prevents a double-read of localStorage
  // (initializer + effect) without needing a separate `didMountRef`.
  useEffect(() => {
    const previousScope = scopeKeyRef.current;
    if (previousScope === scopeKey) return;
    flushPendingWrite(previousScope);
    clearDebounce();
    scopeKeyRef.current = scopeKey;
    if (!enabled) {
      setView(defaults);
      return;
    }
    const envelope = readEnvelope(scopeKey);
    setView(envelope?.view_state ?? defaults);
    // `defaults` identity is owned by the consumer; treat it as stable
    // for the lifetime of one scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, enabled, clearDebounce, flushPendingWrite]);

  // On unmount, flush any pending write so a navigation within the
  // debounce window doesn't drop the user's last edit.
  useEffect(
    () => () => {
      clearDebounce();
      flushPendingWrite(scopeKeyRef.current);
    },
    [clearDebounce, flushPendingWrite],
  );

  const onViewChange = useCallback(
    (next: ViewState) => {
      setView(next);
      if (!enabled) return;
      pendingWriteRef.current = next;
      clearDebounce();
      const scope = scopeKeyRef.current;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        if (scopeKeyRef.current !== scope) return;
        flushPendingWrite(scope);
      }, debounceMs);
    },
    [clearDebounce, debounceMs, enabled, flushPendingWrite],
  );

  const reset = useCallback(() => {
    clearDebounce();
    pendingWriteRef.current = null;
    setView(defaults);
    if (!enabled) return;
    removeEnvelope(scopeKeyRef.current);
  }, [clearDebounce, defaults, enabled]);

  return {
    view: renderSafeView,
    onViewChange,
    isLoading: false,
    reset,
  };
}
