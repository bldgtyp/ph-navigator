// Public surface re-export — matches the export list of the legacy
// `lib.ts` exactly. See `docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md`
// §Phase 1 for the file→symbol mapping.

export {
  clampCellCoord,
  clampRange,
  isCellInNormalizedRange,
  isCellInRange,
  normalizeRange,
  type NormalizedRange,
} from "./range/normalize";
export { computeEdgeBits, type EdgeBits } from "./range/edgeBits";
export { moveActiveCell } from "./range/move";

export {
  formatClipboardCellValue,
  formatClipboardValue,
  parseTsv,
  rangeToHtml,
  rangeToTsv,
} from "./paste/tsv";
export { coercePasteWrites, planPaste, type CoercePasteResult } from "./paste/plan";

export {
  CSV_MIME_TYPE,
  formatExportCellValue,
  sanitizeFilename,
  tableToCsv,
  type CsvExport,
  type TableToCsvParams,
} from "./export/csv";
export {
  JSON_MIME_TYPE,
  tableToJson,
  type JsonExport,
  type TableToJsonParams,
} from "./export/json";

export { applyFilters, defaultOperatorForField } from "./filter/apply";

export { sortRows } from "./sort/sortRows";

export {
  buildEmptyRowDefaults,
  coerceFieldValue,
  extractRowDefaults,
  naturalZero,
} from "./rows/defaults";
export { formatDisplayCellValue, singleSelectOption } from "./rows/format";

export {
  OPTION_COLOR_PALETTE,
  createFieldOption,
  deriveCandidateOptionsFromRows,
} from "./options/create";
export {
  findFieldOptionByLabel,
  hasDuplicateFieldOptionLabels,
  missingOptionReferences,
  optionReferenceCounts,
} from "./options/references";
export { normalizeOptionOrders } from "./options/normalize";

export {
  buildBodyPlan,
  firstDivergeIndex,
  groupPathByRowIdFromBodyPlan,
  groupPathKey,
} from "./body/plan";
export { computeAggregatesByPath } from "./body/aggregates";
export { pruneExpandedGroups } from "./body/prune";

export { effectiveSortFromView, sanitizeViewStateForSchema } from "./view/sanitize";

export { buildFillTargetFromPointer, clampRangeToGroup, splitRangeByGroup } from "./fill/target";
export {
  chooseFillAxis,
  chooseFillDirection,
  type FillAxis,
  type FillDirection,
} from "./fill/axis";
export { planFill, type PlanFillResult } from "./fill/plan";
