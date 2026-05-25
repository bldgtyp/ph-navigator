export { DataTable } from "./DataTable";
export type { AddCustomFieldRequest } from "./components/AddFieldPopover";
export { coerceCustomValue } from "./lib/coerceCustomFieldType";
export type { CoerceResult } from "./lib/coerceCustomFieldType";
export {
  CONVERSION_MATRIX,
  conversionPolicy,
  isConversionAllowed,
} from "./lib/typeConversionMatrix";
export type { ConversionPolicy } from "./lib/typeConversionMatrix";
export { clampNumberPrecision } from "./lib/numberPrecision";
export {
  CUSTOM_FIELD_KEY_PREFIX,
  getCustomValue,
  isCustomFieldKey,
  setCustomValue,
} from "./lib/customFieldAccessor";
export {
  FINGERPRINT_ALGORITHM_VERSION,
  computeTableSchemaFingerprint,
  mintCustomFieldId,
  useTableSchema,
} from "./hooks/useTableSchema";
export type {
  CustomFieldDef,
  CustomFieldType,
  TableSchema,
  UseTableSchemaArgs,
} from "./hooks/useTableSchema";
export {
  SchemaMutationBuildError,
  buildAddFieldMutation,
  buildChangeTypeMutation,
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildEditFieldBundleMutation,
  buildEditOptionsMutation,
  buildRenameFieldMutation,
  buildSetDescriptionMutation,
  buildSetFormulaMutation,
} from "./lib/customFieldMutations";
export { uniqueCopyDisplayName } from "./lib/fieldDisplayNames";
export type {
  AddFieldMutation,
  ChangeTypeMutation,
  DeleteFieldMutation,
  DuplicateFieldMutation,
  EditFieldBundleMutation,
  EditOptionsMutation,
  FieldSchemaMutation,
  RenameFieldMutation,
  SetDescriptionMutation,
  SetFormulaMutation,
} from "./lib/customFieldMutations";
export {
  OPTION_COLOR_PALETTE,
  missingOptionReferences,
  normalizeOptionOrders,
  optionReferenceCounts,
  sanitizeViewStateForSchema,
} from "./lib";
export {
  FIELD_TYPE_DEFAULT_WIDTH,
  GLOBAL_MAX_WIDTH,
  GLOBAL_MIN_WIDTH,
  resolveColumnMax,
  resolveColumnMin,
  resolveColumnWidth,
  sumColumnWidths,
} from "./lib/columnWidths";
export type { FieldRegistryEntry } from "./lib/formula";
export { emptyViewState } from "./types";
export type {
  BuildEmptyRow,
  CellWrite,
  DataTableColumnDef,
  DataTableProps,
  EditCustomFieldBundleRequest,
  FieldDef,
  FieldOption,
  FilterCondition,
  FilterOperator,
  GroupRule,
  RowDeletePayload,
  RowInsertPayload,
  SortRule,
  ViewState,
  WriteOp,
} from "./types";
