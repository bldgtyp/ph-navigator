import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";
import type { AperturesThermalComfortListResponse } from "../comfort-types";

export function apertureThermalComfortQueryKey(
  projectId: string,
  versionId: string | null,
  source: "draft" | "version",
) {
  return ["aperture-thermal-comfort", projectId, versionId, source] as const;
}

export function useApertureThermalComfort(
  projectId: string,
  versionId: string | null,
  source: "draft" | "version",
  enabled = true,
) {
  return useQuery<AperturesThermalComfortListResponse>({
    queryKey: apertureThermalComfortQueryKey(projectId, versionId, source),
    queryFn: ({ signal }) =>
      fetchJson<AperturesThermalComfortListResponse>(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/thermal-comfort?source=${source}`,
        { signal },
      ),
    enabled: enabled && Boolean(versionId),
  });
}
