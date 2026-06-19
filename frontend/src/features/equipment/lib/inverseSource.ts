import type { InverseLinkField } from "../types";
import { ROOMS_TABLE_NAME } from "../types";

export function isRoomsSource(field: InverseLinkField): boolean {
  return field.source_table_path.length === 1 && field.source_table_path[0] === ROOMS_TABLE_NAME;
}
