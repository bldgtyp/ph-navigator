// Hook that fetches catalog glazing rows with optional manufacturer
// filter (Phase 11). Like ``useFrameCatalog`` it runs a paired
// unfiltered query so the picker can show ``Showing N of M``.

import { useQuery } from "@tanstack/react-query";
import { listGlazingTypes } from "../../catalogs/api";
import { catalogQueryKeys } from "../../catalogs/query-keys";

export type UseGlazingCatalogArgs = {
  manufacturers?: string[];
  enabled?: boolean;
};

export type UseGlazingCatalogResult = {
  rows: import("../../catalogs/types").CatalogGlazingType[];
  totalRows: number;
  isLoading: boolean;
  isError: boolean;
};

export function useGlazingCatalog(args: UseGlazingCatalogArgs = {}): UseGlazingCatalogResult {
  const { manufacturers, enabled = true } = args;

  const filtered = useQuery({
    queryKey: [...catalogQueryKeys.glazingTypesList(), { manufacturers: manufacturers ?? null }],
    queryFn: ({ signal }) => listGlazingTypes({ includeInactive: false, manufacturers }, signal),
    select: (payload) => payload.items.filter((r) => r.is_active),
    enabled,
  });

  const all = useQuery({
    queryKey: catalogQueryKeys.glazingTypesList(),
    queryFn: ({ signal }) => listGlazingTypes({ includeInactive: false }, signal),
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
