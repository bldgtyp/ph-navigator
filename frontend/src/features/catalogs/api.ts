import { fetchJson } from "../../shared/api/client";
import type {
  CatalogMaterial,
  CatalogMaterialCreatePayload,
  CatalogMaterialListResponse,
  CatalogMaterialUpdatePayload,
} from "./types";

export async function listMaterials(
  includeInactive: boolean,
  signal?: AbortSignal,
): Promise<CatalogMaterialListResponse> {
  const query = includeInactive ? "?include_inactive=true" : "";
  return fetchJson<CatalogMaterialListResponse>(`/api/v1/catalogs/materials${query}`, { signal });
}

export async function createMaterial(
  payload: CatalogMaterialCreatePayload,
): Promise<CatalogMaterial> {
  return fetchJson<CatalogMaterial>("/api/v1/catalogs/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaterial(
  id: string,
  payload: CatalogMaterialUpdatePayload,
): Promise<CatalogMaterial> {
  return fetchJson<CatalogMaterial>(`/api/v1/catalogs/materials/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateMaterial(id: string): Promise<void> {
  await fetchJson<void>(`/api/v1/catalogs/materials/${id}`, { method: "DELETE" });
}

export async function reactivateMaterial(id: string): Promise<CatalogMaterial> {
  return fetchJson<CatalogMaterial>(`/api/v1/catalogs/materials/${id}/reactivate`, {
    method: "POST",
  });
}
