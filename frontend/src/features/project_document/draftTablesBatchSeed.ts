// Page-scoped batch seed for draft table slices.
//
// A page that mounts N draft tables (e.g. equipment's 7 sub-tables, whose
// `useSliceQuery` calls all fire at the page-component top) calls this hook with
// that table set. It fetches all N slices in ONE request and writes each into
// the matching per-table editor cache via `setQueryData`, so the per-table
// queries read the seed instead of each issuing its own `…/draft/tables/<name>`
// GET — collapsing the initial-mount fan-out to a single batch request.
//
// Gating (the part that makes this race-free): the per-table queries must stay
// idle until the seed is written, or they GET first. The page passes
// `enabled = !isSeeding` to each `useSliceQuery`; `isSeeding` stays true until
// the seeding effect has actually written the cache (not merely until the batch
// resolved), so the queries never enable against an empty cache.
//
// Fallback: when the seed is disabled (viewer mode) or the batch fails, the
// gate releases and each per-table query fetches exactly as it did before — the
// seed is an optimization, never a correctness requirement. The write path
// (`applyAcceptedSlice` / `resolveSliceForWrite`) is untouched.

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchDraftTablesBatch } from "./api";
import { projectDocumentTableQueryKeys } from "./query-keys";

// The per-table editor slice key, from the same shared builder
// `createTableSliceFeature.queryKeys.slice` uses, so the seed lands exactly
// where `useSliceQuery` reads it.
function editorSliceKey(projectId: string, versionId: string, tableName: string) {
  return projectDocumentTableQueryKeys.slice(projectId, tableName, versionId, "editor");
}

export function useDraftTablesBatchSeed({
  projectId,
  versionId,
  tableNames,
  enabled,
}: {
  projectId: string;
  versionId: string | null;
  tableNames: string[];
  enabled: boolean;
}): { isSeeding: boolean } {
  const queryClient = useQueryClient();
  const [seededVersion, setSeededVersion] = useState<string | null>(null);

  // Stable, order-independent key so the effect re-runs only when the set
  // actually changes. Table names match `^[a-z][a-z0-9_]*$` — never a comma.
  const namesKey = useMemo(() => [...new Set(tableNames)].sort().join(","), [tableNames]);
  const active = enabled && Boolean(versionId) && namesKey.length > 0;

  useEffect(() => {
    if (!active || !versionId) return;

    const names = namesKey.split(",");
    // Warm remount (page revisited within gcTime): every per-table cache is
    // still populated, so skip the batch entirely and release the gate — the
    // gated queries read the warm caches with zero round-trips. Without this,
    // remounting would re-fire the batch over data we already hold.
    const allCached = names.every(
      (name) => queryClient.getQueryData(editorSliceKey(projectId, versionId, name)) !== undefined,
    );
    if (allCached) {
      setSeededVersion(versionId);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const tables = await fetchDraftTablesBatch(projectId, versionId, names, controller.signal);
        if (cancelled) return;
        for (const [name, slice] of Object.entries(tables)) {
          queryClient.setQueryData(editorSliceKey(projectId, versionId, name), slice);
        }
      } catch (error) {
        // Seed failed → leave the caches empty; releasing the gate (below) lets
        // each per-table query fall back to its own GET.
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
      } finally {
        // Release the gate only after the cache write (or a real failure), so
        // the per-table queries enable against a populated cache.
        if (!cancelled) setSeededVersion(versionId);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, namesKey, projectId, queryClient, versionId]);

  return { isSeeding: active && seededVersion !== versionId };
}
