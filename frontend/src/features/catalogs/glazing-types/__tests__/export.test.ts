import { describe, expect, test } from "vitest";
import type { CatalogGlazingType } from "../../types";
import { serializeCatalog } from "../import_export/export";
import { CURRENT_SCHEMA_VERSION, FILE_KIND } from "../import_export/types";

const ROW: CatalogGlazingType = {
  id: "rec0000000000001",
  name: "Kawneer | GL-1 | Triple",
  manufacturer: "Kawneer",
  brand: "GL-1",
  suffix: "Triple",
  u_value_w_m2k: 0.625,
  g_value: 0.5,
  color: null,
  source: null,
  datasheet_url: null,
  comments: null,
  is_active: true,
  created_at: "2026-06-24T00:00:00Z",
  updated_at: "2026-06-24T00:00:00Z",
};

describe("glazing-types export", () => {
  test("serializes to schema v2 (window-glass-catalog-enums)", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    const file = serializeCatalog([ROW], {
      exportedBy: "ed@example.com",
      appVersion: null,
      now: new Date("2026-06-24T12:00:00Z"),
    });
    expect(file.kind).toBe(FILE_KIND);
    expect(file.schema_version).toBe(2);
    // The computed `name` round-trips on export (read-only, server-derived).
    expect(file.rows[0]?.name).toBe("Kawneer | GL-1 | Triple");
    expect(file.rows[0]?.manufacturer).toBe("Kawneer");
    expect(file.rows[0]?.brand).toBe("GL-1");
  });
});
