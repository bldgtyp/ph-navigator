import type { AssemblyCondensationResponse } from "./condensation-types";
import type { CondensationIssue } from "./condensation-types";

export type CondensationChipTone = "success" | "warning" | "danger" | "neutral";

export type CondensationChipPresentation = {
  label: string;
  tone: CondensationChipTone;
  muted: boolean;
};

export function isMissingVapourIssue(issue: CondensationIssue): boolean {
  return issue.code === "missing_vapor_data" || issue.code === "missing_membrane_sd";
}

export function condensationChipPresentation(
  result: AssemblyCondensationResponse | null,
  loading: boolean,
  unavailable: boolean,
): CondensationChipPresentation {
  if (loading) return { label: "Condensation: calculating", tone: "neutral", muted: true };
  if (unavailable || result === null) {
    return { label: "Condensation: unavailable", tone: "neutral", muted: true };
  }
  if (result.status.state === "not_screened") {
    return { label: "Condensation: not screened", tone: "neutral", muted: false };
  }
  if (result.status.state === "blocked") {
    const materialCount = missingVaporMaterialCount(result);
    if (materialCount > 0) {
      return {
        label: `Condensation: needs vapour data (${materialCount})`,
        tone: "neutral",
        muted: false,
      };
    }
    if (result.status.flags.includes("missing_climate_source")) {
      return {
        label: "Condensation: needs a climate source",
        tone: "neutral",
        muted: false,
      };
    }
    return { label: "Condensation: needs review", tone: "neutral", muted: false };
  }
  if (result.caveats.some((caveat) => caveat.code === "multiple_condensing_interfaces")) {
    return { label: "Condensation: multiple interfaces", tone: "warning", muted: true };
  }
  if (result.verdict === "d3" || result.verdict === "d4") {
    return { label: "Condensation: exceeds limit", tone: "danger", muted: false };
  }
  if (
    result.verdict === "d2" ||
    (result.criteria !== null &&
      Object.values(result.criteria).some((criterion) => !criterion.is_clear))
  ) {
    return { label: "Condensation: predicted — review", tone: "warning", muted: false };
  }
  if (result.caveats.length > 0) {
    const noun = result.caveats.length === 1 ? "caveat" : "caveats";
    return {
      label: `Condensation: none predicted (${result.caveats.length} ${noun})`,
      tone: "success",
      muted: true,
    };
  }
  return { label: "Condensation: none predicted", tone: "success", muted: false };
}

function missingVaporMaterialCount(result: AssemblyCondensationResponse): number {
  return new Set(
    result.issues
      .filter(isMissingVapourIssue)
      .map((issue) => issue.project_material_id)
      .filter((materialId): materialId is string => materialId !== null),
  ).size;
}
