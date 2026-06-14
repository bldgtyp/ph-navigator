import { fetchJson } from "../../shared/api/client";
import type {
  ClimateDatasetListResponse,
  ClimateLocationDetail,
  ClimateLocationListResponse,
  ClimateLocationSearch,
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
