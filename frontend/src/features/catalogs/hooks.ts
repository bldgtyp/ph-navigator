import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMaterial,
  deactivateMaterial,
  listMaterials,
  reactivateMaterial,
  updateMaterial,
} from "./api";
import { catalogQueryKeys } from "./query-keys";
import type { CatalogMaterialCreatePayload, CatalogMaterialUpdatePayload } from "./types";

function useInvalidateMaterials() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: catalogQueryKeys.materials() });
}

export function useMaterialsQuery(includeInactive: boolean) {
  return useQuery({
    queryKey: catalogQueryKeys.materialsList(includeInactive),
    queryFn: ({ signal }) => listMaterials(includeInactive, signal),
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
