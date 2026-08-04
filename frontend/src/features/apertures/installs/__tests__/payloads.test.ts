import { describe, expect, test } from "vitest";
import { tableFieldDef } from "../../../equipment/testing/testFixtures";
import {
  APERTURE_INSTALL_DATASHEET_FIELD_KEY,
  APERTURE_INSTALL_DEFAULT_TYPE_ID,
  APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
  APERTURE_INSTALL_PHOTO_FIELD_KEY,
  APERTURE_INSTALL_SOURCE_OPTION_KEY,
  type InstallTypeRow,
  type InstallTypesSlice,
} from "../types";
import { APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY } from "../../../../shared/ui/data-table/status";
import {
  installTypesPayloadFromCellWrites,
  installTypesPayloadFromRowDelete,
  installTypesPayloadFromRowDuplicate,
  installTypesPayloadFromRowInsert,
  makeBuildEmptyInstallTypeRow,
  sortedInstallTypes,
  validateInstallTypesPayload,
} from "../payloads";

describe("install type payloads", () => {
  test("routes report, datasheet, and photo attachment writes", () => {
    const payload = installTypesPayloadFromCellWrites(
      installTypesSlice({ aperture_install_types: [installTypeRow()] }),
      [
        { rowId: "apit_1", fieldKey: APERTURE_INSTALL_PDF_REPORT_FIELD_KEY, value: ["asset_pdf"] },
        { rowId: "apit_1", fieldKey: APERTURE_INSTALL_DATASHEET_FIELD_KEY, value: ["asset_ds"] },
        { rowId: "apit_1", fieldKey: APERTURE_INSTALL_PHOTO_FIELD_KEY, value: ["asset_photo"] },
        { rowId: "apit_1", fieldKey: "psi_w_mk", value: 0.021 },
      ],
      {},
      {},
    );
    const row = payload.aperture_install_types.find((entry) => entry.id === "apit_1");
    expect(row?.pdf_report_asset_ids).toEqual(["asset_pdf"]);
    expect(row?.datasheet_asset_ids).toEqual(["asset_ds"]);
    expect(row?.photo_asset_ids).toEqual(["asset_photo"]);
    expect(row?.custom_values.psi_w_mk).toBe(0.021);
  });

  test("insert builds an empty row with the status default", () => {
    const payload = installTypesPayloadFromRowInsert(
      installTypesSlice({ aperture_install_types: [defaultRow()] }),
      [{ rowId: "apit_new", anchorRowId: null, fieldDefaults: {} }],
      makeBuildEmptyInstallTypeRow(),
    );
    const row = payload.aperture_install_types.find((entry) => entry.id === "apit_new");
    expect(row?.custom_values.status).toBe("opt_status_needed");
    expect(row?.pdf_report_asset_ids).toEqual([]);
    expect(validateInstallTypesPayload(payload)).toBeNull();
  });

  test("duplicates clear all three attachment columns", () => {
    const source = installTypeRow({
      pdf_report_asset_ids: ["a1"],
      datasheet_asset_ids: ["a2"],
      photo_asset_ids: ["a3"],
    });
    const payload = installTypesPayloadFromRowDuplicate(
      installTypesSlice({ aperture_install_types: [defaultRow(), source] }),
      [{ sourceRowId: "apit_1", sourceRow: source, rowId: "apit_dup", anchorRowId: "apit_1" }],
    );
    const dup = payload.aperture_install_types.find((entry) => entry.id === "apit_dup");
    expect(dup?.pdf_report_asset_ids).toEqual([]);
    expect(dup?.datasheet_asset_ids).toEqual([]);
    expect(dup?.photo_asset_ids).toEqual([]);
  });

  test("deleting an ordinary row passes validation", () => {
    const ordinary = installTypeRow();
    const payload = installTypesPayloadFromRowDelete(
      installTypesSlice({ aperture_install_types: [defaultRow(), ordinary] }),
      [{ rowId: "apit_1", row: ordinary, anchorRowId: null }],
    );
    expect(payload.aperture_install_types.map((row) => row.id)).toEqual([
      APERTURE_INSTALL_DEFAULT_TYPE_ID,
    ]);
    expect(validateInstallTypesPayload(payload)).toBeNull();
  });

  test("the Default row survives a delete that swept it up", () => {
    const pinned = defaultRow();
    const ordinary = installTypeRow();
    const payload = installTypesPayloadFromRowDelete(
      installTypesSlice({ aperture_install_types: [pinned, ordinary] }),
      [
        { rowId: APERTURE_INSTALL_DEFAULT_TYPE_ID, row: pinned, anchorRowId: null },
        { rowId: ordinary.id, row: ordinary, anchorRowId: null },
      ],
    );
    // The protected row is dropped from the delete set; the sibling still goes.
    expect(payload.aperture_install_types.map((row) => row.id)).toEqual([
      APERTURE_INSTALL_DEFAULT_TYPE_ID,
    ]);
    expect(validateInstallTypesPayload(payload)).toBeNull();
  });

  test("negative psi is rejected", () => {
    const bad = installTypeRow({ custom_values: { record_id: "W-1", psi_w_mk: -0.01 } });
    const payload = installTypesPayloadFromRowDelete(
      installTypesSlice({ aperture_install_types: [defaultRow(), bad] }),
      [],
    );
    expect(validateInstallTypesPayload(payload)).toMatch(/zero or greater/);
  });

  test("the Default row pins to the top of the sort", () => {
    const rows = sortedInstallTypes([
      installTypeRow({ id: "apit_a", custom_values: { record_id: "AAA" } }),
      defaultRow(),
    ]);
    expect(rows[0]?.id).toBe(APERTURE_INSTALL_DEFAULT_TYPE_ID);
  });
});

function installTypesSlice(overrides: Partial<InstallTypesSlice> = {}): InstallTypesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    aperture_install_types: [],
    field_defs: [tableFieldDef({ field_key: "record_id", display_name: "Tag" })],
    single_select_options: {
      [APERTURE_INSTALL_SOURCE_OPTION_KEY]: [
        { id: "opt_apit_src_calculated", label: "Calculated", color: "#8b5cf6", order: 0 },
      ],
      [APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY]: [
        { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 0 },
        { id: "opt_status_complete", label: "Complete", color: "#16a34a", order: 1 },
      ],
    },
    ...overrides,
  };
}

function installTypeRow(overrides: Partial<InstallTypeRow> = {}): InstallTypeRow {
  return {
    id: "apit_1",
    pdf_report_asset_ids: [],
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    notes: null,
    custom_values: { record_id: "W-1", psi_w_mk: 0.021, source: "opt_apit_src_calculated" },
    ...overrides,
  };
}

function defaultRow(): InstallTypeRow {
  return installTypeRow({
    id: APERTURE_INSTALL_DEFAULT_TYPE_ID,
    custom_values: { record_id: null, name: "Default", psi_w_mk: 0.052 },
  });
}
