import { fetchJson } from "../../shared/api/client";
import type {
  CatalogFrameType,
  CatalogFrameTypeCreatePayload,
  CatalogFrameTypeListResponse,
  CatalogFrameTypeUpdatePayload,
  CatalogGlazingType,
  CatalogGlazingTypeCreatePayload,
  CatalogGlazingTypeListResponse,
  CatalogGlazingTypeUpdatePayload,
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

export async function duplicateMaterial(id: string): Promise<CatalogMaterial> {
  return fetchJson<CatalogMaterial>(`/api/v1/catalogs/materials/${id}/duplicate`, {
    method: "POST",
  });
}

export async function listFrameTypes(
  includeInactive: boolean,
  signal?: AbortSignal,
): Promise<CatalogFrameTypeListResponse> {
  const query = includeInactive ? "?include_inactive=true" : "";
  return fetchJson<CatalogFrameTypeListResponse>(`/api/v1/catalogs/frame-types${query}`, {
    signal,
  });
}

export async function createFrameType(
  payload: CatalogFrameTypeCreatePayload,
): Promise<CatalogFrameType> {
  return fetchJson<CatalogFrameType>("/api/v1/catalogs/frame-types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFrameType(
  id: string,
  payload: CatalogFrameTypeUpdatePayload,
): Promise<CatalogFrameType> {
  return fetchJson<CatalogFrameType>(`/api/v1/catalogs/frame-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateFrameType(id: string): Promise<void> {
  await fetchJson<void>(`/api/v1/catalogs/frame-types/${id}`, { method: "DELETE" });
}

export async function reactivateFrameType(id: string): Promise<CatalogFrameType> {
  return fetchJson<CatalogFrameType>(`/api/v1/catalogs/frame-types/${id}/reactivate`, {
    method: "POST",
  });
}

export async function listGlazingTypes(
  includeInactive: boolean,
  signal?: AbortSignal,
): Promise<CatalogGlazingTypeListResponse> {
  const query = includeInactive ? "?include_inactive=true" : "";
  return fetchJson<CatalogGlazingTypeListResponse>(`/api/v1/catalogs/glazing-types${query}`, {
    signal,
  });
}

export async function createGlazingType(
  payload: CatalogGlazingTypeCreatePayload,
): Promise<CatalogGlazingType> {
  return fetchJson<CatalogGlazingType>("/api/v1/catalogs/glazing-types", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateGlazingType(
  id: string,
  payload: CatalogGlazingTypeUpdatePayload,
): Promise<CatalogGlazingType> {
  return fetchJson<CatalogGlazingType>(`/api/v1/catalogs/glazing-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deactivateGlazingType(id: string): Promise<void> {
  await fetchJson<void>(`/api/v1/catalogs/glazing-types/${id}`, { method: "DELETE" });
}

export async function reactivateGlazingType(id: string): Promise<CatalogGlazingType> {
  return fetchJson<CatalogGlazingType>(`/api/v1/catalogs/glazing-types/${id}/reactivate`, {
    method: "POST",
  });
}
