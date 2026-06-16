import { RECORD_ID_FIELD_KEY, type BuildEmptyRow } from "../../../shared/ui/data-table";
import { readStringDefault } from "../../../shared/lib/fieldDefaults";
import { SPACE_TYPE_NAME_FIELD_KEY, type SpaceTypeRow } from "../types";

export function buildEmptySpaceTypeRow({
  rowId,
  fieldDefaults,
}: Parameters<BuildEmptyRow<SpaceTypeRow>>[0]): SpaceTypeRow {
  return {
    id: rowId,
    custom_values: {
      [RECORD_ID_FIELD_KEY]: stringDefault(fieldDefaults[RECORD_ID_FIELD_KEY]),
      [SPACE_TYPE_NAME_FIELD_KEY]: stringDefault(fieldDefaults[SPACE_TYPE_NAME_FIELD_KEY]),
    },
    custom_links: {},
  };
}

function stringDefault(value: unknown): string {
  return readStringDefault(value, "") ?? "";
}
