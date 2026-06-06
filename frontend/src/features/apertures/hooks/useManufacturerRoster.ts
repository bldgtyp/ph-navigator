// Phase 11 — live manufacturer rosters for the filter modal.
//
// One hook returns the distinct manufacturer names + per-name product
// counts for either catalog. TanStack Query caches each roster with a
// 60-second staleTime because the catalog changes rarely; multiple
// pickers / the modal share the cache key.

import { useQuery } from "@tanstack/react-query";
import { listFrameTypeManufacturers, listGlazingTypeManufacturers } from "../../catalogs/api";
import { catalogQueryKeys } from "../../catalogs/query-keys";
import type { CatalogManufacturerEntry } from "../../catalogs/types";
import type { ManufacturerKind } from "../lib/inUseManufacturers";

const STALE_TIME_MS = 60_000;

export type UseManufacturerRosterResult = {
  roster: CatalogManufacturerEntry[];
  isLoading: boolean;
  isError: boolean;
};

export function useManufacturerRoster(
  kind: ManufacturerKind,
  enabled = true,
): UseManufacturerRosterResult {
  const query = useQuery({
    queryKey:
      kind === "frame_types"
        ? catalogQueryKeys.frameTypeManufacturers()
        : catalogQueryKeys.glazingTypeManufacturers(),
    queryFn: ({ signal }) =>
      kind === "frame_types"
        ? listFrameTypeManufacturers(signal)
        : listGlazingTypeManufacturers(signal),
    staleTime: STALE_TIME_MS,
    enabled,
  });

  return {
    roster: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
