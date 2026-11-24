import { describe, expect, it } from "vitest";
import {
  apertureCatalogActionLabel,
  apertureReviewBannerLabel,
  entriesNeedCatalogReview,
  entryIsCustomizedOnly,
  entryNeedsCatalogReview,
} from "../drift";
import type { ApertureDriftEntry } from "../drift-types";

function makeEntry(overrides: Partial<ApertureDriftEntry> = {}): ApertureDriftEntry {
  return {
    aperture_type_id: "apt_1",
    aperture_type_name: "W-01",
    element_id: "el_1",
    element_name: "Center",
    target: "glazing",
    kind: "field_delta",
    catalog_record_id: "rec001",
    deltas: [
      {
        field_key: "u_value_w_m2k",
        catalog_value: 0.65,
        yours_value: 0.72,
        in_local_overrides: false,
      },
    ],
    ...overrides,
  };
}

describe("apertures drift helpers", () => {
  it("separates review-worthy drift from customized-only local overrides", () => {
    const drifted = makeEntry();
    const customized = makeEntry({
      deltas: [
        {
          field_key: "color",
          catalog_value: "#111111",
          yours_value: "#222222",
          in_local_overrides: true,
        },
      ],
    });
    const missing = makeEntry({ kind: "catalog_row_missing", deltas: [] });

    expect(entryNeedsCatalogReview(drifted)).toBe(true);
    expect(entryNeedsCatalogReview(missing)).toBe(true);
    expect(entryNeedsCatalogReview(customized)).toBe(false);
    expect(entryIsCustomizedOnly(customized)).toBe(true);
    expect(entriesNeedCatalogReview([customized])).toBe(false);
    expect(entriesNeedCatalogReview([customized, drifted])).toBe(true);
  });

  it("deduplicates changed field keys per shared product and reports affected elements separately", () => {
    const e1 = makeEntry({ element_id: "el_1" });
    const e2 = makeEntry({
      element_id: "el_2",
      deltas: [
        {
          field_key: "u_value_w_m2k",
          catalog_value: 0.65,
          yours_value: 0.7,
          in_local_overrides: false,
        },
        {
          field_key: "g_value",
          catalog_value: 0.45,
          yours_value: 0.5,
          in_local_overrides: false,
        },
      ],
    });
    expect(apertureCatalogActionLabel([e1])).toBe("Review 1 catalog change");
    expect(apertureCatalogActionLabel([e1, e2])).toBe("Review 2 catalog changes (2 elements)");
    expect(
      apertureCatalogActionLabel([
        makeEntry({ element_id: "el_1", kind: "catalog_row_missing", deltas: [] }),
        makeEntry({ element_id: "el_2", kind: "catalog_row_missing", deltas: [] }),
      ]),
    ).toBe("Catalog source missing (2 elements)");
  });

  it("formats project-wide and active-aperture banner scopes clearly", () => {
    expect(apertureReviewBannerLabel(3, 2, "W-01")).toBe(
      "3 catalog entries need review (2 on W-01).",
    );
    expect(apertureReviewBannerLabel(2, 2, "W-01")).toBe("2 catalog entries need review on W-01.");
    expect(apertureReviewBannerLabel(2, 0, "W-02")).toBe(
      "2 catalog entries need review on other apertures.",
    );
  });
});
