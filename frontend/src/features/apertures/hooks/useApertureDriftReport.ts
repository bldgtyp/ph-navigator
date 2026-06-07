// Phase 12 — fetch the per-project drift report for the active
// document body. Keyed by ``(project, version, source)`` so it can
// share the cache with ``useApertureUValues``.

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";
import type { ApertureDriftReport } from "../drift-types";

export function apertureDriftReportQueryKey(
  projectId: string,
  versionId: string | null,
  source: "draft" | "version",
): readonly unknown[] {
  return ["aperture-drift-report", projectId, versionId, source];
}

export function useApertureDriftReport(
  projectId: string,
  versionId: string | null,
  source: "draft" | "version",
) {
  return useQuery<ApertureDriftReport>({
    queryKey: apertureDriftReportQueryKey(projectId, versionId, source),
    queryFn: ({ signal }) =>
      fetchJson<ApertureDriftReport>(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/drift-report?source=${source}`,
        { signal },
      ),
    enabled: Boolean(versionId),
    staleTime: 0,
  });
}
