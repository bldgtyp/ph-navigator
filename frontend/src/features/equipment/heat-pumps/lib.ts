/**
 * Barrel for the Heat Pump feature's pure support code. The implementation
 * is split across focused sibling modules so each stays small and scannable;
 * every helper keeps its original name and signature, so the many
 * `../lib` / `./lib` importers across this feature are unaffected.
 *
 * - `row-builders` — empty-row factories for each Heat Pump leaf table.
 * - `payload-builders` — generic-table replace/insert/delete/duplicate
 *   payload builders, cell-write application, and option merging.
 * - `sorting` — stable tag-then-id sorts per leaf table.
 * - `tags` — unique-tag-on-add and rename-collision checks.
 * - `option-helpers` — single-select option label lookup and minting.
 * - `labels` — human-readable row labels for equipment, units, rooms, ERVs.
 */
export * from "./row-builders";
export * from "./payload-builders";
export * from "./sorting";
export * from "./tags";
export * from "./option-helpers";
export * from "./labels";
