// Hook that fetches catalog frame rows with optional Phase 06 filters
// (location, operation) plus the Phase 11 manufacturers filter. Returns
// the filtered list and the unfiltered total so the picker can render
// the ``Showing N of M frames · Clear filter`` footnote.
//
// The hook makes *two* queries — one with the filters applied and one
// for the unfiltered universe — so the "M" stays correct even when the
// filter excludes most rows. Both queries share the same backend
// endpoint, so the cache hits cleanly across pickers.

import { useQuery } from "@tanstack/react-query";
import { listFrameTypes } from "../../catalogs/api";
import { catalogQueryKeys } from "../../catalogs/query-keys";
import type { FrameLocation } from "../picker-filters";

export type UseFrameCatalogArgs = {
  location?: FrameLocation;
  operation?: string;
  manufacturers?: string[];
  enabled?: boolean;
};

export type UseFrameCatalogResult = {
  rows: import("../../catalogs/types").CatalogFrameType[];
  totalRows: number;
  isLoading: boolean;
  isError: boolean;
};

export function useFrameCatalog(args: UseFrameCatalogArgs = {}): UseFrameCatalogResult {
  const { location, operation, manufacturers, enabled = true } = args;

  const filtered = useQuery({
    queryKey: [
      ...catalogQueryKeys.frameTypesList(),
      {
        location: location ?? null,
        operation: operation ?? null,
        manufacturers: manufacturers ?? null,
      },
    ],
    queryFn: ({ signal }) =>
      listFrameTypes({ includeInactive: false, location, operation, manufacturers }, signal),
    select: (payload) => payload.items.filter((r) => r.is_active),
    enabled,
  });

  const all = useQuery({
    queryKey: catalogQueryKeys.frameTypesList(),
    queryFn: ({ signal }) => listFrameTypes({ includeInactive: false }, signal),
    select: (payload) => payload.items.filter((r) => r.is_active),
    enabled,
  });

  return {
    rows: filtered.data ?? [],
    totalRows: all.data?.length ?? 0,
    isLoading: filtered.isLoading || all.isLoading,
    isError: filtered.isError || all.isError,
  };
}
