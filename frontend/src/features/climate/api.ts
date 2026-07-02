import { fetchJson } from "../../shared/api/client";
import type { ProjectLocationUpdateResponse } from "../projects/types";
import type {
  ClimateDatasetListResponse,
  ClimateDatasetRosterResponse,
  ClimateLocationDetail,
  ClimateLocationListResponse,
  ClimateLocationSearch,
  ClimateRosterSearch,
  ClimateSourceDeriveKind,
  CreateClimateSourceRequest,
  EpwRosterResponse,
  EpwRosterSearch,
  PhClimateKind,
  ProjectClimateSource,
  ProjectClimateSourceListResponse,
} from "./types";

export async function fetchClimateDatasets(
  signal?: AbortSignal,
): Promise<ClimateDatasetListResponse> {
  return fetchJson<ClimateDatasetListResponse>("/api/v1/climate/datasets", { signal });
}

export async function fetchClimateLocations(
  datasetId: string,
  search: ClimateLocationSearch,
  signal?: AbortSignal,
): Promise<ClimateLocationListResponse> {
  const query = buildLocationQuery(search);
  const suffix = query ? `?${query}` : "";
  return fetchJson<ClimateLocationListResponse>(
    `/api/v1/climate/datasets/${datasetId}/locations${suffix}`,
    { signal },
  );
}

export async function fetchClimateLocation(
  datasetId: string,
  locationId: string,
  signal?: AbortSignal,
): Promise<ClimateLocationDetail> {
  return fetchJson<ClimateLocationDetail>(
    `/api/v1/climate/datasets/${datasetId}/locations/${locationId}`,
    { signal },
  );
}

export async function fetchAttachedClimateRecord(
  projectId: string,
  sourceId: string,
  signal?: AbortSignal,
): Promise<ClimateLocationDetail> {
  return fetchJson<ClimateLocationDetail>(
    `/api/v1/projects/${projectId}/climate/sources/${sourceId}/record`,
    { signal },
  );
}

// Serialize the search filters into the backend's query params. `near`
// becomes the `near=lat,long` string the route parses; country/region are
// passed through; paging is clamped server-side.
export function buildLocationQuery(search: ClimateLocationSearch): string {
  const params = new URLSearchParams();
  if (search.country) params.set("country", search.country);
  if (search.region) params.set("region", search.region);
  if (search.near) params.set("near", `${search.near.latitude},${search.near.longitude}`);
  if (search.limit != null) params.set("limit", String(search.limit));
  if (search.offset != null) params.set("offset", String(search.offset));
  return params.toString();
}

// The picker feed: a PH dataset's stations for a project, each with
// backend-computed proximity, nearest-first. `region` filters by state
// (default = project's state); `near` is the any-state nearest mode (O-DP-3).
export async function fetchClimateDatasetRoster(
  projectId: string,
  kind: PhClimateKind,
  search: ClimateRosterSearch,
  signal?: AbortSignal,
): Promise<ClimateDatasetRosterResponse> {
  const params = new URLSearchParams();
  if (search.region) params.set("region", search.region);
  if (search.near) params.set("near", "true");
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return fetchJson<ClimateDatasetRosterResponse>(
    `/api/v1/projects/${projectId}/climate/datasets/${kind}/locations${suffix}`,
    { signal },
  );
}

// The weather picker feed: OneBuilding EPW stations for a project, nearest-first
// (no proximity verdict). `region` filters by state (default = project's);
// `near` is the any-state nearest mode.
export async function fetchEpwRoster(
  projectId: string,
  search: EpwRosterSearch,
  signal?: AbortSignal,
): Promise<EpwRosterResponse> {
  const params = new URLSearchParams();
  if (search.region) params.set("region", search.region);
  if (search.near) params.set("near", "true");
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return fetchJson<EpwRosterResponse>(`/api/v1/projects/${projectId}/climate/epw-roster${suffix}`, {
    signal,
  });
}

// ---- Project-scoped climate sources (Phase 3b) ----

function sourcesPath(projectId: string): string {
  return `/api/v1/projects/${projectId}/climate/sources`;
}

// Attach the OneBuilding station the map picker selected, by its zip URL. The
// server downloads + parses + stores it as the single weather source.
export async function attachWeatherFromCatalog(
  projectId: string,
  url: string,
): Promise<ProjectClimateSource> {
  return fetchJson<ProjectClimateSource>(`${sourcesPath(projectId)}/weather/from-catalog`, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// The manually-uploaded weather bundle: already-stored EPW (required) + optional
// STAT / DDY asset ids. The server validates + parses them into the weather source.
export type WeatherUploadRefs = {
  epw_asset_id: string;
  stat_asset_id?: string | null;
  ddy_asset_id?: string | null;
};

export async function attachWeatherFromUpload(
  projectId: string,
  refs: WeatherUploadRefs,
): Promise<ProjectClimateSource> {
  return fetchJson<ProjectClimateSource>(`${sourcesPath(projectId)}/weather/from-upload`, {
    method: "POST",
    body: JSON.stringify(refs),
  });
}

export async function fetchClimateSources(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectClimateSourceListResponse> {
  return fetchJson<ProjectClimateSourceListResponse>(sourcesPath(projectId), { signal });
}

export async function createClimateSource(
  projectId: string,
  body: CreateClimateSourceRequest,
): Promise<ProjectClimateSource> {
  return fetchJson<ProjectClimateSource>(sourcesPath(projectId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteClimateSource(projectId: string, sourceId: string): Promise<void> {
  await fetchJson<void>(`${sourcesPath(projectId)}/${sourceId}`, { method: "DELETE" });
}

// Attach one climate type from the nearest source for the project's saved
// coordinates. `weather` covers EPW + ASHRAE together. The server reads the
// stored location, so no coordinates are sent.
export async function deriveClimateSource(
  projectId: string,
  kind: ClimateSourceDeriveKind,
): Promise<ProjectLocationUpdateResponse> {
  return fetchJson<ProjectLocationUpdateResponse>(
    `/api/v1/projects/${projectId}/location/derive/${kind}`,
    { method: "POST" },
  );
}
