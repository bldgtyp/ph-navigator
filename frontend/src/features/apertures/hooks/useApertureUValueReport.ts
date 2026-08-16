import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";
import { apertureQueryKeys } from "../query-keys";
import type { ApertureReadSource, ApertureSide } from "../types";
import type { ApertureUValueWarning } from "./useApertureUValues";

export type ApertureUValueReportEdge = {
  side: ApertureSide;
  frame_id: string | null;
  frame_name: string | null;
  width_m: number | null;
  u_value_w_m2k: number | null;
  psi_g_w_mk: number | null;
  psi_install_w_mk: number | null;
  edge_length_m: number;
  interior_length_m: number | null;
  center_strip_area_m2: number | null;
  corner_area_a_m2: number | null;
  corner_area_b_m2: number | null;
  frame_area_m2: number | null;
  q_frame_w_k: number | null;
  q_spacer_w_k: number | null;
};

export type ApertureUValueReportElement = {
  element_id: string;
  element_name: string;
  grid_label: string;
  glazing_id: string | null;
  glazing_name: string | null;
  glazing_u_w_m2k: number | null;
  glazing_g_value: number | null;
  width_m: number;
  height_m: number;
  interior_width_m: number | null;
  interior_height_m: number | null;
  u_value_w_m2k: number;
  area_m2: number;
  glazing_area_m2: number;
  frame_area_m2: number;
  q_glazing_w_k: number | null;
  q_frame_total_w_k: number | null;
  q_spacer_total_w_k: number | null;
  unfinished: boolean;
  edges: ApertureUValueReportEdge[];
  warnings: ApertureUValueWarning[];
};

export type ApertureUValueReportSection = {
  aperture_type_id: string;
  name: string;
  overall_width_m: number;
  overall_height_m: number;
  /** Every element in the grid, Empty panels included — NOT `elements.length`. */
  element_count: number;
  void_count: number;
  unfinished_count: number;
  total_area_m2: number;
  window_u_value_w_m2k: number;
  shgc_glazing_area_weighted: number | null;
  warnings: ApertureUValueWarning[];
  elements: ApertureUValueReportElement[];
};

export type ApertureUValueReport = {
  project_id: string;
  version_id: string;
  source: ApertureReadSource;
  provenance: {
    project_name: string;
    bt_number: string;
    version_label: string;
    source: ApertureReadSource;
    generated_note: string;
  };
  apertures: ApertureUValueReportSection[];
};

export function useApertureUValueReport(
  projectId: string,
  versionId: string | null,
  source: ApertureReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: apertureQueryKeys.uValueReport(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) =>
      fetchJson<ApertureUValueReport>(
        `/api/v1/projects/${projectId}/versions/${resolvedVersionId}/apertures/u-values/report?source=${source}`,
        { signal },
      ),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}
