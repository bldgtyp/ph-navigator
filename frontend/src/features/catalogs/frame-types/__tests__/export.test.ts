import { describe, expect, test } from "vitest";
import type { CatalogFrameType } from "../../types";
import { serializeCatalog } from "../import_export/export";
import { CURRENT_SCHEMA_VERSION, FILE_KIND } from "../import_export/types";

const ROW: CatalogFrameType = {
  id: "rec0000000000001",
  name: "Alpen | Tyrol | Window | Casement | Head",
  manufacturer: "Alpen",
  brand: "Tyrol",
  use: "Window",
  operation: "Casement",
  location: "Head",
  mull_type: null,
  prefix: null,
  suffix: null,
  material: "Aluminum",
  width_mm: 100,
  u_value_w_m2k: 0.85,
  psi_g_w_mk: 0.04,
  psi_install_w_mk: null,
  color: null,
  source: null,
  datasheet_url: null,
  comments: null,
  is_active: true,
  created_at: "2026-06-24T00:00:00Z",
  updated_at: "2026-06-24T00:00:00Z",
};

describe("frame-types export", () => {
  test("serializes to schema v2 (window-frames-catalog-enums)", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    const file = serializeCatalog([ROW], {
      exportedBy: "ed@example.com",
      appVersion: null,
      now: new Date("2026-06-24T12:00:00Z"),
    });
    expect(file.kind).toBe(FILE_KIND);
    expect(file.schema_version).toBe(2);
    // The computed `name` round-trips on export (read-only, server-derived).
    expect(file.rows[0]?.name).toBe("Alpen | Tyrol | Window | Casement | Head");
    expect(file.rows[0]?.manufacturer).toBe("Alpen");
  });
});
