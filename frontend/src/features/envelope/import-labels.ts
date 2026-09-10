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
  reused_material_values_differ:
    "The reused project material's values differ from the file — the project's values are kept.",
  import_unsupported_layer_type:
    "A layer uses a honeybee material with no thickness (a declared-U layer, for example) — skipped.",
  import_material_unresolved: "A layer references a material the file does not contain — skipped.",
  import_unsupported_divisions: "This layer's divisions have more than one row — skipped.",
  import_missing_cell_material: "A layer division is missing its material — skipped.",
  import_invalid_file: "This construction could not be read — skipped.",
  steel_stud_spacing_from_grid:
    "Steel-stud spacing was recorded for the whole layer — it was applied to every segment, so trim it to the studs.",
};

export function importWarningLabel(code: string): string {
  return IMPORT_WARNING_LABELS[code] ?? code;
}
