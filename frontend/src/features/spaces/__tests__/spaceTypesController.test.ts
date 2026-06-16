import { describe, expect, test } from "vitest";
import { RECORD_ID_FIELD_KEY } from "../../../shared/ui/data-table";
import { buildEmptySpaceTypeRow } from "../lib/buildEmptySpaceTypeRow";
import {
  spaceTypesPayloadFromCellWrites,
  spaceTypesPayloadFromRowDuplicate,
  spaceTypesPayloadFromRowInsert,
  validateSpaceTypesPayload,
} from "../lib/spaceTypesController";
import { SPACE_TYPE_NAME_FIELD_KEY } from "../types";
import { buildSpaceType, buildSpaceTypesSlice } from "../testing/testFixtures";

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
