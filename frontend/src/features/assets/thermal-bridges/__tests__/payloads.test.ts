import { describe, expect, test } from "vitest";
import { tableFieldDef } from "../../../equipment/testing/testFixtures";
import {
  THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
  THERMAL_BRIDGE_PHOTO_FIELD_KEY,
  THERMAL_BRIDGE_TYPE_OPTION_KEY,
  type ThermalBridgeRow,
  type ThermalBridgesSlice,
} from "../../../equipment/types";
import {
  thermalBridgesPayloadFromCellWrites,
  thermalBridgesPayloadFromRowDuplicate,
} from "../payloads";

describe("thermal bridge payloads", () => {
  test("routes report and photo attachment writes", () => {
    const payload = thermalBridgesPayloadFromCellWrites(
      thermalBridgesSlice({ thermal_bridges: [thermalBridgeRow()] }),
      [
        { rowId: "tb_1", fieldKey: THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY, value: ["asset_pdf_1"] },
        { rowId: "tb_1", fieldKey: THERMAL_BRIDGE_PHOTO_FIELD_KEY, value: ["asset_photo_1"] },
      ],
      {},
      {},
    );

    expect(payload.thermal_bridges[0]?.pdf_report_asset_ids).toEqual(["asset_pdf_1"]);
    expect(payload.thermal_bridges[0]?.photo_asset_ids).toEqual(["asset_photo_1"]);
  });

  test("duplicates clear report and photo attachments", () => {
    const source = thermalBridgeRow({
      pdf_report_asset_ids: ["asset_pdf_source"],
      photo_asset_ids: ["asset_photo_source"],
    });
    const payload = thermalBridgesPayloadFromRowDuplicate(
      thermalBridgesSlice({ thermal_bridges: [source] }),
      [{ sourceRowId: "tb_1", sourceRow: source, rowId: "tb_dup", anchorRowId: "tb_1" }],
    );

    expect(payload.thermal_bridges[1]?.pdf_report_asset_ids).toEqual([]);
    expect(payload.thermal_bridges[1]?.photo_asset_ids).toEqual([]);
  });
});

function thermalBridgesSlice(overrides: Partial<ThermalBridgesSlice> = {}): ThermalBridgesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    thermal_bridges: [],
    field_defs: [tableFieldDef({ field_key: "record_id", display_name: "Tag" })],
    single_select_options: { [THERMAL_BRIDGE_TYPE_OPTION_KEY]: [] },
    ...overrides,
  };
}

function thermalBridgeRow(overrides: Partial<ThermalBridgeRow> = {}): ThermalBridgeRow {
  return {
    id: "tb_1",
    thermal_bridge_type: null,
    pdf_report_asset_ids: [],
    photo_asset_ids: [],
    notes: null,
    custom_values: { record_id: "TB-1" },
    ...overrides,
  };
}
