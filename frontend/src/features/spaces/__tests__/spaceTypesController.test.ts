import { describe, expect, test } from "vitest";
import { RECORD_ID_FIELD_KEY } from "../../../shared/ui/data-table";
import { buildEmptySpaceTypeRow } from "../lib/buildEmptySpaceTypeRow";
import {
  spaceTypesPayloadFromCellWrites,
  spaceTypesPayloadFromRowDuplicate,
  spaceTypesPayloadFromRowInsert,
  validateSpaceTypesPayload,
} from "../lib/spaceTypesController";
import { SPACE_TYPE_NAME_FIELD_KEY, type SpaceTypesSlice } from "../types";

describe("spaceTypesPayloadBuilders", () => {
  test("adds an empty Space-Type row through the slice-replace payload", () => {
    const slice = buildSpaceTypesSlice();
    const payload = spaceTypesPayloadFromRowInsert(
      slice,
      [{ rowId: "st_1", fieldDefaults: {}, anchorRowId: null }],
      buildEmptySpaceTypeRow,
    );

    expect(payload.space_types).toEqual([
      {
        id: "st_1",
        custom_values: { record_id: "", name: "" },
        custom_links: {},
      },
    ]);
  });

  test("writes Tag and Name through the custom_values bag", () => {
    const slice = buildSpaceTypesSlice({
      space_types: [buildSpaceType({ id: "st_1" })],
    });
    const payload = spaceTypesPayloadFromCellWrites(
      slice,
      [
        { rowId: "st_1", fieldKey: RECORD_ID_FIELD_KEY, value: "Office" },
        { rowId: "st_1", fieldKey: SPACE_TYPE_NAME_FIELD_KEY, value: "Open Office" },
      ],
      {},
    );

    expect(payload.space_types[0]?.custom_values).toMatchObject({
      record_id: "Office",
      name: "Open Office",
    });
  });

  test("duplicates with an Airtable-style Tag copy suffix", () => {
    const slice = buildSpaceTypesSlice({
      space_types: [
        buildSpaceType({ id: "st_1", tag: "Office" }),
        buildSpaceType({ id: "st_2", tag: "Office (copy)" }),
      ],
    });
    const payload = spaceTypesPayloadFromRowDuplicate(slice, [
      {
        rowId: "st_3",
        anchorRowId: "st_2",
        sourceRowId: "st_1",
        sourceRow: slice.space_types[0]!,
      },
    ]);

    expect(payload.space_types.map((row) => row.id)).toEqual(["st_1", "st_2", "st_3"]);
    expect(payload.space_types[2]?.custom_values.record_id).toBe("Office (copy 2)");
  });

  test("validates non-empty unique Tags", () => {
    expect(
      validateSpaceTypesPayload({
        ...buildSpaceTypesSlice(),
        space_types: [buildSpaceType({ tag: "", name: "Office" })],
      }),
    ).toBe("Space-Type Tag is required.");
    expect(
      validateSpaceTypesPayload({
        ...buildSpaceTypesSlice(),
        space_types: [buildSpaceType({ tag: "", name: "" })],
      }),
    ).toBeNull();
    expect(
      validateSpaceTypesPayload({
        ...buildSpaceTypesSlice(),
        space_types: [
          buildSpaceType({ id: "a", tag: "Office" }),
          buildSpaceType({ id: "b", tag: "office" }),
        ],
      }),
    ).toBe("Space-Type Tags must be unique: Office and office.");
  });
});

function buildSpaceTypesSlice(overrides: Partial<SpaceTypesSlice> = {}): SpaceTypesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    space_types: [],
    field_defs: [
      {
        field_key: RECORD_ID_FIELD_KEY,
        display_name: "Tag",
        field_type: "short_text",
        config: {},
        description: null,
        origin: "built_in",
        created_at: "2026-06-16T00:00:00Z",
        created_by: null,
      },
      {
        field_key: SPACE_TYPE_NAME_FIELD_KEY,
        display_name: "Name",
        field_type: "short_text",
        config: {},
        description: null,
        origin: "built_in",
        created_at: "2026-06-16T00:00:00Z",
        created_by: null,
      },
    ],
    single_select_options: {},
    rows_computed: {},
    inverse_links: {},
    inverse_link_fields: [],
    inverse_links_fingerprint: "",
    ...overrides,
  };
}

function buildSpaceType({
  id = "st_1",
  tag = "Office",
  name = "Office",
}: {
  id?: string;
  tag?: string;
  name?: string;
} = {}) {
  return {
    id,
    custom_values: {
      [RECORD_ID_FIELD_KEY]: tag,
      [SPACE_TYPE_NAME_FIELD_KEY]: name,
    },
    custom_links: {},
  };
}
