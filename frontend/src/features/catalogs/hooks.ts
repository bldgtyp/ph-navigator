import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFrameType,
  createGlazingType,
  createMaterial,
  deactivateFrameType,
  deactivateGlazingType,
  deactivateMaterial,
  listFrameTypes,
  listGlazingTypes,
  listMaterials,
  reactivateFrameType,
  reactivateGlazingType,
  reactivateMaterial,
  updateFrameType,
  updateGlazingType,
  updateMaterial,
} from "./api";
import { catalogQueryKeys } from "./query-keys";
import type {
  CatalogFrameTypeCreatePayload,
  CatalogFrameTypeUpdatePayload,
  CatalogGlazingTypeCreatePayload,
  CatalogGlazingTypeUpdatePayload,
  CatalogMaterialCreatePayload,
  CatalogMaterialUpdatePayload,
} from "./types";

function useInvalidateMaterials() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
}

// Fetches the full catalog (active + deactivated) in one shot. Consumers
// that only want active rows filter on `is_active` client-side. This keeps
// the cache key stable across the "Show deactivated" toggle so the toggle
// no longer triggers a network round-trip.
export function useMaterialsQuery(enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.materialsList(),
    queryFn: ({ signal }) => listMaterials(true, signal),
    enabled,
    select: (payload) => payload.items,
  });
}

export function useCreateMaterialMutation() {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: (payload: CatalogMaterialCreatePayload) => createMaterial(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMaterialMutation() {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CatalogMaterialUpdatePayload }) =>
      updateMaterial(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeactivateMaterialMutation() {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: (id: string) => deactivateMaterial(id),
    onSuccess: invalidate,
  });
}

export function useReactivateMaterialMutation() {
  const invalidate = useInvalidateMaterials();
  return useMutation({
    mutationFn: (id: string) => reactivateMaterial(id),
    onSuccess: invalidate,
  });
}

function useInvalidateFrameTypes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.frameTypes() });
}

export function useFrameTypesQuery(enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.frameTypesList(),
    queryFn: ({ signal }) => listFrameTypes(true, signal),
    select: (payload) => payload.items,
    enabled,
  });
}

export function useCreateFrameTypeMutation() {
  const invalidate = useInvalidateFrameTypes();
  return useMutation({
    mutationFn: (payload: CatalogFrameTypeCreatePayload) => createFrameType(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateFrameTypeMutation() {
  const invalidate = useInvalidateFrameTypes();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CatalogFrameTypeUpdatePayload }) =>
      updateFrameType(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeactivateFrameTypeMutation() {
  const invalidate = useInvalidateFrameTypes();
  return useMutation({
    mutationFn: (id: string) => deactivateFrameType(id),
    onSuccess: invalidate,
  });
}

export function useReactivateFrameTypeMutation() {
  const invalidate = useInvalidateFrameTypes();
  return useMutation({
    mutationFn: (id: string) => reactivateFrameType(id),
    onSuccess: invalidate,
  });
}

function useInvalidateGlazingTypes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.glazingTypes() });
}

export function useGlazingTypesQuery(enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.glazingTypesList(),
    queryFn: ({ signal }) => listGlazingTypes(true, signal),
    enabled,
    select: (payload) => payload.items,
  });
}

export function useCreateGlazingTypeMutation() {
  const invalidate = useInvalidateGlazingTypes();
  return useMutation({
    mutationFn: (payload: CatalogGlazingTypeCreatePayload) => createGlazingType(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateGlazingTypeMutation() {
  const invalidate = useInvalidateGlazingTypes();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CatalogGlazingTypeUpdatePayload }) =>
      updateGlazingType(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeactivateGlazingTypeMutation() {
  const invalidate = useInvalidateGlazingTypes();
  return useMutation({
    mutationFn: (id: string) => deactivateGlazingType(id),
    onSuccess: invalidate,
  });
}

export function useReactivateGlazingTypeMutation() {
  const invalidate = useInvalidateGlazingTypes();
  return useMutation({
    mutationFn: (id: string) => reactivateGlazingType(id),
    onSuccess: invalidate,
  });
}
