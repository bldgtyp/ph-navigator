export { DataTable } from "./DataTable";
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
  buildTableSchema,
  FINGERPRINT_ALGORITHM_VERSION,
  computeTableSchemaFingerprint,
  mintCustomFieldId,
  tableFieldDefsToFieldDefs,
  useTableSchema,
} from "./hooks/useTableSchema";
export type {
  CustomFieldDef,
  CustomFieldType,
  TableFieldDef,
  TableFieldRenderOverlay,
  TableFieldRenderOverlays,
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
  buildNextConfigForFieldTypeChange,
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
export { OPTION_COLOR_PALETTE } from "./lib/options/create";
export { missingOptionReferences, optionReferenceCounts } from "./lib/options/references";
export { normalizeOptionOrders } from "./lib/options/normalize";
export { sanitizeViewStateForSchema } from "./lib/view/sanitize";
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
export { RECORD_ID_FIELD_KEY } from "./lib/identifier/recordId";
export { emptyViewState } from "./types";
export type {
  AddCustomFieldRequest,
  BuildEmptyRow,
  CellWrite,
  DataTableColumnDef,
  DataTableProps,
  EditCustomFieldBundleRequest,
  FieldDef,
  FieldLockKey,
  FieldOption,
  FilterCondition,
  FilterOperator,
  GroupRule,
  RowDeletePayload,
  RowDuplicatePayload,
  RowInsertPayload,
  SortRule,
  ViewState,
  WriteOp,
} from "./types";
export {
  ALL_FIELD_LOCKS,
  DEFAULT_BUILT_IN_LOCKS,
  FIELD_LOCKED_TOOLTIP,
  isAttributeLocked,
  isBuiltInField,
  isFieldDeletable,
  isFieldDuplicable,
} from "./lib/locks";
