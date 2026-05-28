// Custom-field schema mutation handlers (add / delete / duplicate /
// edit-bundle), factored out of `useSliceTableController` so the
// orchestrator can stay focused on payload commits and conflict
// handling. Every feature tab routes its grid's
// `onAdd/Delete/Duplicate/EditCustomField` props through this hook
// unchanged.

import { useCallback, useMemo } from "react";
import {
  buildAddFieldMutation,
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildEditFieldBundleMutation,
  buildNextConfigForFieldTypeChange,
  isCustomFieldKey,
  uniqueCopyDisplayName,
} from "../index";
import { insertAfterColumnOrder } from "../lib/view/columnOrder";
import type { AddCustomFieldRequest, EditCustomFieldBundleRequest, ViewState } from "../types";
import type { TableSchema } from "../index";
import type { FieldSchemaMutation } from "../lib/customFieldMutations";

export type UseCustomFieldHandlersArgs = {
  tableKey: string;
  canEdit: boolean;
  tableSchema: TableSchema;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  commitSchemaMutation: (mutation: FieldSchemaMutation) => Promise<unknown>;
};

export type CustomFieldHandlers = {
  handleAddCustomField: (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;
  handleEditCustomFieldBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
  handleDeleteCustomField: (fieldKey: string) => Promise<void>;
  handleDuplicateCustomField: (fieldKey: string) => Promise<{ newFieldKey: string }>;
};

export function useCustomFieldHandlers(args: UseCustomFieldHandlersArgs): CustomFieldHandlers {
  const { tableKey, canEdit, tableSchema, view, onViewChange, commitSchemaMutation } = args;
  const customFieldList = useMemo(() => tableSchema.customFields, [tableSchema.customFields]);
  const tableFieldList = useMemo(() => tableSchema.tableFields, [tableSchema.tableFields]);

  const handleDeleteCustomField = useCallback(
    async (fieldKey: string) => {
      if (!canEdit) return;
      const mutation = buildDeleteFieldMutation({
        tableKey,
        fieldId: fieldKey,
        schemaFingerprint: tableSchema.schemaFingerprint,
      });
      await commitSchemaMutation(mutation);
    },
    [canEdit, commitSchemaMutation, tableKey, tableSchema.schemaFingerprint],
  );

  const handleDuplicateCustomField = useCallback(
    async (fieldKey: string): Promise<{ newFieldKey: string }> => {
      if (!canEdit) {
        throw new Error("Cannot duplicate a field while editing is disabled.");
      }
      const source = customFieldList.find((field) => field.field_key === fieldKey);
      if (!source) {
        throw new Error("That custom field no longer exists. Refresh to see the current fields.");
      }
      const newFieldId = tableSchema.mintCustomFieldId();
      const mutation = buildDuplicateFieldMutation({
        tableKey,
        sourceFieldId: fieldKey,
        newField: {
          field_key: newFieldId,
          display_name: uniqueCopyDisplayName(
            source.display_name,
            tableSchema.fieldDefs.map((fieldDef) => fieldDef.display_name),
          ),
          field_type: source.field_type,
          config: structuredClone(source.config),
          description: source.description,
          origin: "custom",
          created_at: new Date().toISOString(),
          created_by: null,
        },
        schemaFingerprint: tableSchema.schemaFingerprint,
      });
      await commitSchemaMutation(mutation);
      const nextOrder = insertAfterColumnOrder(view.columnOrder, fieldKey, newFieldId);
      if (nextOrder) {
        onViewChange({ ...view, columnOrder: nextOrder });
      }
      return { newFieldKey: newFieldId };
    },
    [canEdit, commitSchemaMutation, customFieldList, onViewChange, tableKey, tableSchema, view],
  );

  const handleEditCustomFieldBundle = useCallback(
    async (request: EditCustomFieldBundleRequest) => {
      if (!canEdit) return;
      const source = tableFieldList.find((field) => field.field_key === request.fieldKey);
      if (!source) {
        throw new Error("That field no longer exists. Refresh to see the current fields.");
      }
      const nextFieldType = request.fieldType ?? source.field_type;
      const nextConfig = buildNextConfigForFieldTypeChange(source, request);
      const mutation = buildEditFieldBundleMutation({
        tableKey,
        fieldId: request.fieldKey,
        after: {
          ...source,
          display_name: request.displayName,
          description: request.description,
          field_type: nextFieldType,
          config: nextConfig,
        },
        nextOptions: request.options,
        acknowledgeDestructive: request.acknowledgeDestructive ?? false,
        formulaSource: request.formulaSource,
        schemaFingerprint: tableSchema.schemaFingerprint,
      });
      await commitSchemaMutation(mutation);
    },
    [canEdit, commitSchemaMutation, tableFieldList, tableKey, tableSchema.schemaFingerprint],
  );

  const handleAddCustomField = useCallback(
    async (request: AddCustomFieldRequest): Promise<{ newFieldKey: string }> => {
      if (!canEdit) {
        throw new Error("Cannot add a field while editing is disabled.");
      }
      const newFieldId = tableSchema.mintCustomFieldId();
      // The backend's `insert_after_field_id` only references existing
      // custom fields. When the visual anchor is a core column, forward
      // null so the new field appends to `custom_fields`; the
      // columnOrder splice below still places it in the visible slot
      // the user asked for.
      const backendAnchor =
        request.insertAfterFieldKey && isCustomFieldKey(request.insertAfterFieldKey)
          ? request.insertAfterFieldKey
          : null;
      const mutation = buildAddFieldMutation({
        tableKey,
        newField: {
          field_key: newFieldId,
          display_name: request.displayName,
          field_type: request.fieldType,
          config: request.config,
          description: request.description,
          origin: "custom",
          created_at: new Date().toISOString(),
          created_by: null,
        },
        insertAfterFieldId: backendAnchor,
        initialOptions: request.initialOptions,
        schemaFingerprint: tableSchema.schemaFingerprint,
      });
      await commitSchemaMutation(mutation);
      if (request.insertAfterFieldKey) {
        const nextOrder = insertAfterColumnOrder(
          view.columnOrder,
          request.insertAfterFieldKey,
          newFieldId,
        );
        if (nextOrder) {
          onViewChange({ ...view, columnOrder: nextOrder });
        }
      }
      return { newFieldKey: newFieldId };
    },
    [canEdit, commitSchemaMutation, onViewChange, tableKey, tableSchema, view],
  );

  return {
    handleAddCustomField,
    handleDeleteCustomField,
    handleDuplicateCustomField,
    handleEditCustomFieldBundle,
  };
}
