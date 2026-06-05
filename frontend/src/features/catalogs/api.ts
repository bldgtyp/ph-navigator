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

export type FrameTypeListFilters = {
  includeInactive?: boolean;
  location?: string;
  operation?: string;
  use?: string;
  manufacturers?: string[];
};

export async function listFrameTypes(
  includeInactiveOrFilters: boolean | FrameTypeListFilters,
  signal?: AbortSignal,
): Promise<CatalogFrameTypeListResponse> {
  const filters: FrameTypeListFilters =
    typeof includeInactiveOrFilters === "boolean"
      ? { includeInactive: includeInactiveOrFilters }
      : includeInactiveOrFilters;
  const params = new URLSearchParams();
  if (filters.includeInactive) params.set("include_inactive", "true");
  if (filters.location) params.set("location", filters.location);
  if (filters.operation) params.set("operation", filters.operation);
  if (filters.use) params.set("use", filters.use);
  for (const m of filters.manufacturers ?? []) params.append("manufacturers", m);
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return fetchJson<CatalogFrameTypeListResponse>(`/api/v1/catalogs/frame-types${suffix}`, {
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

export async function duplicateFrameType(id: string): Promise<CatalogFrameType> {
  return fetchJson<CatalogFrameType>(`/api/v1/catalogs/frame-types/${id}/duplicate`, {
    method: "POST",
  });
}

export type GlazingTypeListFilters = {
  includeInactive?: boolean;
  manufacturers?: string[];
};

export async function listGlazingTypes(
  includeInactiveOrFilters: boolean | GlazingTypeListFilters,
  signal?: AbortSignal,
): Promise<CatalogGlazingTypeListResponse> {
  const filters: GlazingTypeListFilters =
    typeof includeInactiveOrFilters === "boolean"
      ? { includeInactive: includeInactiveOrFilters }
      : includeInactiveOrFilters;
  const params = new URLSearchParams();
  if (filters.includeInactive) params.set("include_inactive", "true");
  for (const m of filters.manufacturers ?? []) params.append("manufacturers", m);
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return fetchJson<CatalogGlazingTypeListResponse>(`/api/v1/catalogs/glazing-types${suffix}`, {
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

export async function duplicateGlazingType(id: string): Promise<CatalogGlazingType> {
  return fetchJson<CatalogGlazingType>(`/api/v1/catalogs/glazing-types/${id}/duplicate`, {
    method: "POST",
  });
}
