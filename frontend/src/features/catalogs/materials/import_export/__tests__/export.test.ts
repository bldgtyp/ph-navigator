import { describe, expect, test } from "vitest";
import type { CatalogMaterial } from "../../../types";
import { CURRENT_SCHEMA_VERSION, FILE_KIND } from "../types";
import { exportFilename, formatCatalogJson, serializeCatalog } from "../export";

function row(overrides: Partial<CatalogMaterial> = {}): CatalogMaterial {
  return {
    id: "rec0000000000000A",
    name: "XPS",
    category: "insulation",
    density_kg_m3: 35,
    specific_heat_j_kgk: 1500,
    conductivity_w_mk: 0.034,
    emissivity: 0.9,
    color: "#dce6f0",
    source: "Manufacturer datasheet",
    url: "https://example.com/xps.pdf",
    comments: "Type IV per ASTM C578",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
    ...overrides,
  };
}

describe("serializeCatalog", () => {
  test("envelope carries kind, schema_version, exportedBy, appVersion", () => {
    const file = serializeCatalog([row()], {
      exportedBy: "ed@example.com",
      appVersion: "0.1.0",
      now: new Date("2026-06-03T22:00:00Z"),
    });
    expect(file.kind).toBe(FILE_KIND);
    expect(file.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(file.exported_by).toBe("ed@example.com");
    expect(file.app_version).toBe("0.1.0");
    expect(file.exported_at).toBe("2026-06-03T22:00:00.000Z");
    expect(file.rows).toHaveLength(1);
  });

  test("projected row carries exactly the canonical ten keys (id + nine fields)", () => {
    const file = serializeCatalog([row()], { exportedBy: null, appVersion: null });
    const [first] = file.rows;
    if (!first) throw new Error("expected one row");
    expect(Object.keys(first)).toEqual([
      "id",
      "name",
      "category",
      "density_kg_m3",
      "specific_heat_j_kgk",
      "conductivity_w_mk",
      "emissivity",
      "color",
      "source",
      "url",
      "comments",
    ]);
  });

  test("audit columns (is_active, created_*, updated_*) are excluded", () => {
    const file = serializeCatalog([row()], { exportedBy: null, appVersion: null });
    const [first] = file.rows;
    if (!first) throw new Error("expected one row");
    const keys = Object.keys(first);
    expect(keys).not.toContain("is_active");
    expect(keys).not.toContain("created_at");
    expect(keys).not.toContain("created_by");
    expect(keys).not.toContain("updated_at");
    expect(keys).not.toContain("updated_by");
  });

  test("nullable fields round-trip as null, not undefined or omitted", () => {
    const file = serializeCatalog([row({ color: null, source: null, url: null, comments: null })], {
      exportedBy: null,
      appVersion: null,
    });
    const [first] = file.rows;
    if (!first) throw new Error("expected one row");
    expect(first.color).toBeNull();
    expect(first.source).toBeNull();
    expect(first.url).toBeNull();
    expect(first.comments).toBeNull();
  });
});

describe("formatCatalogJson", () => {
  test("pretty-prints with 2-space indent + trailing newline", () => {
    const file = serializeCatalog([row()], {
      exportedBy: null,
      appVersion: null,
      now: new Date("2026-06-03T22:00:00Z"),
    });
    const text = formatCatalogJson(file);
    expect(text.endsWith("\n")).toBe(true);
    // First indented line should start with two spaces.
    const firstIndented = text.split("\n").find((line) => line.startsWith(" "));
    expect(firstIndented?.startsWith("  ")).toBe(true);
  });

  test("output round-trips through JSON.parse to the same object", () => {
    const file = serializeCatalog([row()], {
      exportedBy: "ed@example.com",
      appVersion: "0.1.0",
      now: new Date("2026-06-03T22:00:00Z"),
    });
    const text = formatCatalogJson(file);
    expect(JSON.parse(text)).toEqual(file);
  });
});

describe("exportFilename", () => {
  test("uses YYYYMMDD stamp from the supplied date", () => {
    // Use a noon UTC date so the local-tz offset doesn't bump the day.
    expect(exportFilename(new Date("2026-06-03T12:00:00Z"))).toMatch(
      /^materials-catalog_2026060[34]\.json$/,
    );
  });
});
