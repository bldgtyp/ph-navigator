// Phase 11 — provide the document-level manufacturer allow-lists +
// the open-filters callback to the pickers without threading prop
// chains through four card / row components. The provider lives in
// ``AperturesTab`` (it has the slice + the modal state in scope); the
// pickers consume the hook anywhere underneath it.
//
// ``null`` for either field means "all manufacturers enabled". The
// hook returns ``undefined`` when there is no provider in the tree
// (e.g. the picker is rendered in isolation in a Storybook-style test),
// so the picker's existing optional ``manufacturers`` prop continues to
// take precedence.

import { createContext, useContext } from "react";
import type { ManufacturerFilters } from "../types";
import type { ManufacturerKind } from "../lib/inUseManufacturers";

export type ManufacturerFilterContextValue = {
  filters: ManufacturerFilters | null;
  openManufacturerFilters: () => void;
};

const ManufacturerFilterContext = createContext<ManufacturerFilterContextValue | undefined>(
  undefined,
);

export const ManufacturerFilterProvider = ManufacturerFilterContext.Provider;

export function useManufacturerFilter(kind: ManufacturerKind): string[] | undefined {
  const ctx = useContext(ManufacturerFilterContext);
  if (ctx === undefined) return undefined;
  if (ctx.filters === null) return undefined;
  const list =
    kind === "frame_types"
      ? ctx.filters.frame_manufacturers_enabled
      : ctx.filters.glazing_manufacturers_enabled;
  return list ?? undefined;
}

// Open-modal callback for picker hints. Returns ``undefined`` when no
// provider is mounted, in which case the picker hint stays hidden.
export function useOpenManufacturerFilters(): (() => void) | undefined {
  return useContext(ManufacturerFilterContext)?.openManufacturerFilters;
}
