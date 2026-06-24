import type {
  Assembly,
  EnvelopeReadResponse,
  ProjectMaterial,
  ProjectMaterialDriftItem,
} from "../types";

/**
 * Exports read the last committed version, never the draft. When a draft
 * exists, ask the user to confirm before exporting the saved version, and
 * return whether the export should proceed. `action` names the menu item in
 * the prompt (e.g. "Download constructions", "Download in PHPP format").
 */
export function confirmDraftExport(
  current: Pick<EnvelopeReadResponse, "source" | "draft_etag">,
  action: string,
): boolean {
  if (current.source === "draft" && current.draft_etag) {
    return window.confirm(
      `${action} reads the last committed version, not your current draft. Save Version or Save As first if the draft should be included. Continue with the saved version?`,
    );
  }
  return true;
}

export function exportErrorDetails(error: unknown): string | null {
  if (!(error instanceof Error) || !("details" in error)) return null;
  const details = (error as { details?: Record<string, unknown> }).details;
  const errors = details?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const lines = errors
    .slice(0, 5)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const assemblyName =
        typeof record.assembly_name === "string" ? record.assembly_name : "Assembly";
      const code =
        typeof record.code === "string" ? record.code.replaceAll("_", " ") : "export issue";
      return `${assemblyName}: ${code}`;
    })
    .filter(Boolean);
  if (!lines.length) return null;
  const suffix = errors.length > lines.length ? ` (${errors.length - lines.length} more)` : "";
  return `HBJSON export needs attention: ${lines.join("; ")}${suffix}`;
}

export function countAssemblyMaterialDrift(
  assembly: Assembly,
  driftByMaterialId: ReadonlyMap<string, ProjectMaterialDriftItem>,
): number {
  const materialIds = new Set<string>();
  let count = 0;
  for (const layer of assembly.layers) {
    for (const segment of layer.segments) {
      const materialId = segment.project_material_id;
      if (!materialId || materialIds.has(materialId)) continue;
      materialIds.add(materialId);
      const item = driftByMaterialId.get(materialId);
      if (item && item.state !== "in_sync") count += 1;
    }
  }
  return count;
}

export function hasCatalogOriginMaterials(materials: ProjectMaterial[]): boolean {
  return materials.some((material) => material.catalog_origin !== null);
}
