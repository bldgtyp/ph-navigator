// TanStack hook that fetches the per-aperture composite U-Value list
// from the Phase 09 backend. Returns one ``ApertureUValueResult`` per
// aperture type in the active draft (or saved version) document.
//
// The query key is namespaced by (project, version, source) so a
// switch between draft and saved triggers a fresh fetch. Auto-
// invalidation on draft mutations happens at the route layer: the
// command-dispatch hook calls ``queryClient.invalidateQueries`` when
// the audit envelope reports ``affects_u_value=true``.

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";

export type ApertureUValueWarning = {
  kind: "missing_frame" | "missing_glazing" | "missing_dimension" | "non_positive_glazing_area";
  element_id: string | null;
  side: "top" | "right" | "bottom" | "left" | null;
  axis: "row" | "column" | null;
  message: string;
};

export type ApertureElementUValue = {
  element_id: string;
  u_value_w_m2k: number;
  area_m2: number;
  glazing_area_m2: number;
  frame_area_m2: number;
  warnings: ApertureUValueWarning[];
};

export type ApertureUValueResult = {
  aperture_type_id: string;
  window_u_value_w_m2k: number;
  total_area_m2: number;
  elements: ApertureElementUValue[];
  warnings: ApertureUValueWarning[];
  content_hash: string;
};

export type AperturesUValueListResponse = {
  project_id: string;
  version_id: string;
  source: "draft" | "version";
  apertures: ApertureUValueResult[];
};

export const APERTURE_U_VALUES_QUERY_KEY = "apertures-u-values" as const;

export function apertureUValuesQueryKey(
  projectId: string,
  versionId: string,
  source: "draft" | "version",
) {
  return [APERTURE_U_VALUES_QUERY_KEY, projectId, versionId, source] as const;
}

export function useApertureUValues(
  projectId: string | null | undefined,
  versionId: string | null | undefined,
  source: "draft" | "version",
) {
  return useQuery({
    queryKey: apertureUValuesQueryKey(projectId ?? "", versionId ?? "", source),
    queryFn: ({ signal }) =>
      fetchJson<AperturesUValueListResponse>(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/u-values?source=${source}`,
        { signal },
      ),
    enabled: Boolean(projectId) && Boolean(versionId),
    staleTime: 0,
  });
}
