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

export function useMaterialsQuery(includeInactive: boolean, enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.materialsList(includeInactive),
    queryFn: ({ signal }) => listMaterials(includeInactive, signal),
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

export function useFrameTypesQuery(includeInactive: boolean, enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.frameTypesList(includeInactive),
    queryFn: ({ signal }) => listFrameTypes(includeInactive, signal),
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

export function useGlazingTypesQuery(includeInactive: boolean, enabled = true) {
  return useQuery({
    queryKey: catalogQueryKeys.glazingTypesList(includeInactive),
    queryFn: ({ signal }) => listGlazingTypes(includeInactive, signal),
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
