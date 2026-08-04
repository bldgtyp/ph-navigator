// Paired with backend/tests/test_aperture_install_psi.py (resolver cases:
// assigned / mull / inherited default, stale interior slot ignored,
// dangling ref → default, psi-less type → 0). Keep in lockstep with the
// backend precedence when it changes.
import { describe, expect, test } from "vitest";
import { edgeClassKey } from "../edge-classification";
import { APERTURE_INSTALL_DEFAULT_TYPE_ID, resolveInstallPsiForAperture } from "../install-psi";
import type { ApertureElement, ApertureInstallTypeSummary, ApertureTypeEntry } from "../types";
import { apertureElement, apertureEntry } from "./aperture-ui-test-fixtures";

const FLIXO: ApertureInstallTypeSummary = {
  id: "apit_flixo_sill",
  name: "Flixo Sill",
  psi_w_mk: 0.021,
  source: "opt_apit_src_calculated",
  has_pdf: true,
};

const DEFAULT_TYPE: ApertureInstallTypeSummary = {
  id: APERTURE_INSTALL_DEFAULT_TYPE_ID,
  name: "Default",
  psi_w_mk: 0.052,
  source: "opt_apit_src_program_default",
  has_pdf: false,
};

describe("resolveInstallPsiForAperture (mirror of backend resolver)", () => {
  test("precedence: assigned, mull, inherited default", () => {
    const resolved = resolveInstallPsiForAperture(mullPair({ top: FLIXO.id }), [
      DEFAULT_TYPE,
      FLIXO,
    ]);

    const assigned = resolved.get(edgeClassKey("aptel_left", "top"));
    expect(assigned).toMatchObject({
      psiWmk: 0.021,
      source: "assigned",
      installTypeId: FLIXO.id,
      installTypeName: "Flixo Sill",
    });

    const mull = resolved.get(edgeClassKey("aptel_left", "right"));
    expect(mull).toMatchObject({ psiWmk: 0, source: "mull", installTypeId: null });

    const inherited = resolved.get(edgeClassKey("aptel_left", "bottom"));
    expect(inherited).toMatchObject({
      psiWmk: 0.052,
      source: "default",
      installTypeId: APERTURE_INSTALL_DEFAULT_TYPE_ID,
    });
  });

  test("stale interior assignment is ignored", () => {
    const resolved = resolveInstallPsiForAperture(mullPair({ right: FLIXO.id }), [
      DEFAULT_TYPE,
      FLIXO,
    ]);
    expect(resolved.get(edgeClassKey("aptel_left", "right"))).toMatchObject({
      psiWmk: 0,
      source: "mull",
    });
  });

  test("dangling slot ref falls back to the default", () => {
    const resolved = resolveInstallPsiForAperture(mullPair({ top: "apit_ghost" }), [DEFAULT_TYPE]);
    expect(resolved.get(edgeClassKey("aptel_left", "top"))).toMatchObject({
      psiWmk: 0.052,
      source: "default",
    });
  });

  test("a type without a psi value resolves to 0", () => {
    const resolved = resolveInstallPsiForAperture(mullPair({ top: FLIXO.id }), [
      DEFAULT_TYPE,
      { ...FLIXO, psi_w_mk: null },
    ]);
    expect(resolved.get(edgeClassKey("aptel_left", "top"))).toMatchObject({
      psiWmk: 0,
      source: "assigned",
    });
  });

  test("void elements are skipped", () => {
    const aperture = mullPair({});
    aperture.elements[1] = { ...aperture.elements[1]!, kind: "void", installs: nullInstalls() };
    const resolved = resolveInstallPsiForAperture(aperture, [DEFAULT_TYPE]);
    expect(resolved.has(edgeClassKey("aptel_right", "top"))).toBe(false);
    // The glazed element's edge against the void panel is a perimeter edge.
    expect(resolved.get(edgeClassKey("aptel_left", "right"))).toMatchObject({
      source: "default",
    });
  });
});

function mullPair(
  leftInstalls: Partial<Record<"top" | "right" | "bottom" | "left", string>>,
): ApertureTypeEntry {
  return apertureEntry({
    id: "apt_install_test",
    name: "Install Test",
    row_heights_mm: [1000],
    column_widths_mm: [800, 800],
    elements: [
      element("aptel_left", [0, 0], { ...nullInstalls(), ...leftInstalls }),
      element("aptel_right", [1, 1], nullInstalls()),
    ],
  });
}

function element(
  id: string,
  columnSpan: [number, number],
  installs: ApertureElement["installs"],
): ApertureElement {
  return apertureElement({ id, name: id, row_span: [0, 0], column_span: columnSpan, installs });
}

function nullInstalls(): ApertureElement["installs"] {
  return { top: null, right: null, bottom: null, left: null };
}
