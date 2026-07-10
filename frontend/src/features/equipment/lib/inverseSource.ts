import type { InverseLinkField } from "../types";
import { ROOMS_TABLE_NAME } from "../types";

export function isRoomsSource(field: InverseLinkField): boolean {
  return field.source_table_path.length === 1 && field.source_table_path[0] === ROOMS_TABLE_NAME;
}

export function inverseFieldKey(field: InverseLinkField): string {
  return `inverse:${field.source_key}`;
}

export function inverseColumnHeader(field: InverseLinkField): string {
  return `${field.source_table_display} ← ${field.source_field_display_name}`;
}

export function inverseIdsForTarget(
  inverseLinks: Record<string, Record<string, string[]>> | undefined,
  targetRowId: string,
  field: InverseLinkField,
): readonly string[] {
  return inverseLinks?.[targetRowId]?.[field.source_key] ?? [];
}
