// Hook that fetches active catalog frame rows with optional backend
// filters. FramePicker now uses this for manufacturer-scoped rows and
// applies side / operation-family filters client-side, because those
// rules need multi-value matches such as Head+Any and Swing+Casement.

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
  const isUnfiltered =
    location === undefined &&
    operation === undefined &&
    (manufacturers === undefined || manufacturers.length === 0);

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
    enabled: enabled && !isUnfiltered,
  });

  const allRows = isUnfiltered ? filtered.data : all.data;

  return {
    rows: filtered.data ?? [],
    totalRows: allRows?.length ?? 0,
    isLoading: filtered.isLoading || (!isUnfiltered && all.isLoading),
    isError: filtered.isError || (!isUnfiltered && all.isError),
  };
}
