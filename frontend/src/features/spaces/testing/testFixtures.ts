import {
  buildTableSchema,
  RECORD_ID_FIELD_KEY,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import {
  SPACE_TYPE_NAME_FIELD_KEY,
  SPACE_TYPES_TABLE_NAME,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../types";

const CREATED_AT = "2026-06-16T00:00:00Z";

export function buildSpaceTypesSlice(overrides: Partial<SpaceTypesSlice> = {}): SpaceTypesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    space_types: [],
    field_defs: [spaceTypeFieldDef(RECORD_ID_FIELD_KEY, "Tag"), spaceTypeFieldDef("name", "Name")],
    single_select_options: {},
    rows_computed: {},
    inverse_links: {},
    inverse_link_fields: [],
    inverse_links_fingerprint: "",
    ...overrides,
  };
}

export function buildSpaceType({
  id = "st_1",
  tag = "Office",
  name = "Office",
}: {
  id?: string;
  tag?: string;
  name?: string;
} = {}): SpaceTypeRow {
  return {
    id,
    custom_values: {
      [RECORD_ID_FIELD_KEY]: tag,
      [SPACE_TYPE_NAME_FIELD_KEY]: name,
    },
    custom_links: {},
  };
}

export function schemaForSpaceTypes(slice: SpaceTypesSlice): TableSchema {
  return buildTableSchema({
    tableKey: SPACE_TYPES_TABLE_NAME,
    fieldDefs: slice.field_defs,
    singleSelectOptions: slice.single_select_options,
  });
}

function spaceTypeFieldDef(fieldKey: string, displayName: string): TableFieldDef {
  return {
    field_key: fieldKey,
    display_name: displayName,
    field_type: "short_text",
    config: {},
    description: null,
    origin: "built_in",
    created_at: CREATED_AT,
    created_by: null,
  };
}
