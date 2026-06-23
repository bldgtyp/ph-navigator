import type { ConstructionImportAction, MaterialImportDecision } from "./types";

export const CONSTRUCTION_ACTION_LABELS: Record<ConstructionImportAction, string> = {
  add_new: "Add new",
  replace: "Replace existing",
  skip: "Skip",
};

export const MATERIAL_DECISION_LABELS: Record<MaterialImportDecision, string> = {
  reuse_project_material: "Reuse existing",
  reuse_catalog_in_project: "Reuse (catalog copy)",
  pick_from_catalog: "Copy from catalog",
  create_new: "Create new",
};

const IMPORT_WARNING_LABELS: Record<string, string> = {
  replace_target_missing: "Original assembly is gone — adding as new instead.",
  ambiguous_in_project_catalog_material:
    "Several project materials share this catalog source — a fresh copy was made.",
  catalog_material_missing:
    "The catalog material no longer exists — created as a project material.",
  catalog_material_inactive: "The catalog material is deactivated — created as a project material.",
  name_matched_project_material: "Matched an existing project material by name.",
  name_matched_catalog_material: "Matched a catalog material by name.",
  ambiguous_name_in_project: "Several project materials share this name.",
};

export function importWarningLabel(code: string): string {
  return IMPORT_WARNING_LABELS[code] ?? code;
}
