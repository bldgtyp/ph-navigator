export { DataTable } from "./DataTable";
export type { AddCustomFieldRequest } from "./components/AddFieldPopover";
export { ChangeTypePopover } from "./components/ChangeTypePopover";
export type { ChangeTypePopoverProps, ChangeTypeRequest } from "./components/ChangeTypePopover";
export type { EditCustomFieldDescriptionRequest } from "./components/EditFieldDescriptionPopover";
export { coerceCustomValue } from "./lib/coerceCustomFieldType";
export type { CoerceResult } from "./lib/coerceCustomFieldType";
export {
  CONVERSION_MATRIX,
  conversionPolicy,
  isConversionAllowed,
} from "./lib/typeConversionMatrix";
export type { ConversionPolicy } from "./lib/typeConversionMatrix";
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
export { emptyViewState } from "./types";
export type {
  BuildEmptyRow,
  CellWrite,
  DataTableColumnDef,
  DataTableProps,
  EditCustomFieldFormulaRequest,
  FieldDef,
  FieldOption,
  FilterCondition,
  FilterOperator,
  FormulaFieldRegistryEntry,
  GroupRule,
  RowDeletePayload,
  RowInsertPayload,
  RenameCustomFieldRequest,
  SortRule,
  ViewState,
  WriteOp,
} from "./types";
