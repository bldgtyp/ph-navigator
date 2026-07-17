import type { EditCustomFieldBundleRequest, FieldDef, WriteOp } from "../../shared/ui/data-table";
import type { CatalogOptionOperation } from "./types";

export type CatalogLegacyOptionsMutation = Extract<
  WriteOp,
  { kind: "schemaMutation"; variant: "legacyOptions" }
>;

function labelOfOption(optionId: string, mutation: CatalogLegacyOptionsMutation): string | null {
  const inAfter = (mutation.after.options ?? []).find((option) => option.id === optionId);
  const inBefore = (mutation.before.options ?? []).find((option) => option.id === optionId);
  return inAfter?.label ?? inBefore?.label ?? null;
}

export function buildCatalogLabelReplacements(
  mutation: CatalogLegacyOptionsMutation,
): Record<string, string> {
  if (mutation.optionReplacements) {
    const replacements: Record<string, string> = {};
    for (const [deletedId, targetId] of Object.entries(mutation.optionReplacements)) {
      const deletedLabel = labelOfOption(deletedId, mutation);
      const targetLabel = labelOfOption(targetId, mutation);
      if (deletedLabel && targetLabel) replacements[deletedLabel] = targetLabel;
    }
    return replacements;
  }

  const afterIds = new Set((mutation.after.options ?? []).map((option) => option.id));
  const deleted = (mutation.before.options ?? []).filter((option) => !afterIds.has(option.id));
  if (deleted.length === 0 || !mutation.cellWrites?.length) return {};
  const target = mutation.cellWrites.find(
    (write) => typeof write.value === "string" && write.value,
  )?.value;
  if (typeof target !== "string") return {};
  const targetLabel = labelOfOption(target, mutation);
  if (!targetLabel) return {};
  return Object.fromEntries(deleted.map((option) => [option.label, targetLabel]));
}

export function buildCatalogOptionRenames(
  mutation: CatalogLegacyOptionsMutation,
): CatalogOptionOperation[] {
  const afterById = new Map((mutation.after.options ?? []).map((option) => [option.id, option]));
  return (mutation.before.options ?? []).flatMap((before) => {
    const after = afterById.get(before.id);
    if (!after || after.label === before.label) return [];
    return [{ kind: "rename", old_label: before.label, new_label: after.label }];
  });
}

export function buildCatalogOptionMutation(
  request: EditCustomFieldBundleRequest,
  fieldDefs: FieldDef[],
  editableFields: ReadonlySet<string>,
): CatalogLegacyOptionsMutation {
  const before = fieldDefs.find((fieldDef) => fieldDef.field_key === request.fieldKey);
  if (!before || !editableFields.has(request.fieldKey) || !request.options) {
    throw new Error(`Cannot edit options for ${request.fieldKey}.`);
  }
  return {
    kind: "schemaMutation",
    variant: "legacyOptions",
    before,
    after: {
      ...before,
      display_name: request.displayName,
      description: request.description ?? undefined,
      options: request.options,
    },
    optionReplacements: request.optionReplacements,
  };
}
