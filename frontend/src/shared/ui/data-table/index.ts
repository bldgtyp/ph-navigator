export { DataTable } from "./DataTable";
export type { AddCustomFieldRequest } from "./components/AddFieldPopover";
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
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildRenameFieldMutation,
  buildSetDescriptionMutation,
} from "./lib/customFieldMutations";
export type {
  AddFieldMutation,
  ChangeTypeMutation,
  DeleteFieldMutation,
  DuplicateFieldMutation,
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
