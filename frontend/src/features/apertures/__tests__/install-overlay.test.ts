// Installs-modal view-model: tint cells (assigned/default/mull), the
// deterministic palette, paint-click transitions, grid-signature
// filtering (mirror of the backend `_grid_signature`), and usage counts.
import { describe, expect, test } from "vitest";
import {
  DEFAULT_TINT_TOKEN,
  apertureGridSignature,
  installOverlayModel,
  installTintColors,
  installUsageCounts,
  nextInstallForClick,
} from "../install-overlay";
import { APERTURE_INSTALL_DEFAULT_TYPE_ID } from "../install-psi";
import type { ApertureElement, ApertureInstallTypeSummary, ApertureTypeEntry } from "../types";
import { apertureElement, apertureEntry } from "./aperture-ui-test-fixtures";

const DEFAULT_TYPE: ApertureInstallTypeSummary = {
  id: APERTURE_INSTALL_DEFAULT_TYPE_ID,
  name: "Default",
  psi_w_mk: 0.052,
  source: "opt_apit_src_program_default",
  has_pdf: false,
};
const FLIXO: ApertureInstallTypeSummary = {
  id: "apit_flixo_sill",
  name: "Flixo Sill",
  psi_w_mk: 0.021,
  source: "opt_apit_src_calculated",
  has_pdf: true,
};

function mullPair(leftInstalls: Partial<ApertureElement["installs"]> = {}): ApertureTypeEntry {
  return apertureEntry({
    id: "apt_a",
    row_heights_mm: [1000],
    column_widths_mm: [800, 800],
    elements: [
      apertureElement({
        id: "aptel_left",
        column_span: [0, 0],
        installs: { top: null, right: null, bottom: null, left: null, ...leftInstalls },
      }),
      apertureElement({ id: "aptel_right", column_span: [1, 1] }),
    ],
  });
}

describe("installOverlayModel", () => {
  test("classifies assigned, default, and mull cells with colors", () => {
    const cells = installOverlayModel(mullPair({ top: FLIXO.id }), [DEFAULT_TYPE, FLIXO]);
    const byKey = new Map(cells.map((cell) => [`${cell.elementId}:${cell.side}`, cell]));

    expect(byKey.get("aptel_left:top")).toMatchObject({
      kind: "assigned",
      rawSlot: FLIXO.id,
      resolved: { installTypeId: FLIXO.id, psiWmk: FLIXO.psi_w_mk },
    });
    expect(byKey.get("aptel_left:top")?.color).not.toBe(DEFAULT_TINT_TOKEN);
    expect(byKey.get("aptel_left:right")).toMatchObject({ kind: "mull", color: null });
    expect(byKey.get("aptel_left:bottom")).toMatchObject({
      kind: "default",
      rawSlot: null,
      resolved: { installTypeId: APERTURE_INSTALL_DEFAULT_TYPE_ID },
      color: DEFAULT_TINT_TOKEN,
    });
    // Void-free pair: 2 glazed elements × 4 sides.
    expect(cells).toHaveLength(8);
  });

  test("bands have non-zero thickness even without picked frames", () => {
    const cells = installOverlayModel(mullPair(), [DEFAULT_TYPE]);
    for (const cell of cells) {
      expect(cell.rect.width).toBeGreaterThan(0);
      expect(cell.rect.height).toBeGreaterThan(0);
    }
  });
});

describe("installTintColors", () => {
  test("default row gets the neutral swatch; others cycle the palette deterministically", () => {
    const colors = installTintColors([DEFAULT_TYPE, FLIXO, { ...FLIXO, id: "apit_two" }]);
    expect(colors.get(APERTURE_INSTALL_DEFAULT_TYPE_ID)).toBe(DEFAULT_TINT_TOKEN);
    expect(colors.get(FLIXO.id)).toBeDefined();
    expect(colors.get(FLIXO.id)).not.toBe(colors.get("apit_two"));
  });
});

describe("nextInstallForClick", () => {
  test("no armed type is a no-op", () => {
    expect(nextInstallForClick(null, null)).toBeUndefined();
    expect(nextInstallForClick(FLIXO.id, null)).toBeUndefined();
  });

  test("armed type assigns, re-click clears to inherit", () => {
    expect(nextInstallForClick(null, FLIXO.id)).toBe(FLIXO.id);
    expect(nextInstallForClick(FLIXO.id, FLIXO.id)).toBeNull();
    expect(nextInstallForClick("apit_other", FLIXO.id)).toBe(FLIXO.id);
  });
});

describe("apertureGridSignature", () => {
  test("matches across identical layouts with different mm dimensions", () => {
    const wider = apertureEntry({
      id: "apt_b",
      row_heights_mm: [1200],
      column_widths_mm: [900, 900],
      elements: [
        apertureElement({ id: "aptel_b1", column_span: [0, 0] }),
        apertureElement({ id: "aptel_b2", column_span: [1, 1] }),
      ],
    });
    expect(apertureGridSignature(wider)).toBe(apertureGridSignature(mullPair()));
  });

  test("differs when spans or kinds differ", () => {
    const withVoid = apertureEntry({
      id: "apt_c",
      row_heights_mm: [1000],
      column_widths_mm: [800, 800],
      elements: [
        apertureElement({ id: "aptel_c1", column_span: [0, 0] }),
        apertureElement({ id: "aptel_c2", column_span: [1, 1], kind: "void" }),
      ],
    });
    expect(apertureGridSignature(withVoid)).not.toBe(apertureGridSignature(mullPair()));
    const single = apertureEntry({
      id: "apt_d",
      elements: [apertureElement({ id: "aptel_d1" })],
    });
    expect(apertureGridSignature(single)).not.toBe(apertureGridSignature(mullPair()));
  });
});

describe("installUsageCounts", () => {
  test("counts assigned slots across every aperture", () => {
    const counts = installUsageCounts([
      mullPair({ top: FLIXO.id, left: FLIXO.id }),
      mullPair({ bottom: FLIXO.id }),
    ]);
    expect(counts.get(FLIXO.id)).toBe(3);
    expect(counts.get(APERTURE_INSTALL_DEFAULT_TYPE_ID)).toBeUndefined();
  });
});
