// Staged Installs-modal edits: nothing reaches the document until Save, and
// what Save writes must match exactly what the modal showed.
import { describe, expect, test } from "vitest";
import {
  EMPTY_INSTALLS_DRAFT,
  draftApertureEntry,
  draftInstallTypes,
  installsDraftCommands,
  installsDraftIsDirty,
  stageInstall,
  stageTypeCreate,
  stageTypeEdit,
} from "../installs-draft";
import { APERTURE_INSTALL_DEFAULT_TYPE_ID } from "../install-psi";
import type { ApertureInstallTypeSummary } from "../types";
import { apertureElement, apertureEntry } from "./aperture-ui-test-fixtures";

const DEFAULT_TYPE: ApertureInstallTypeSummary = {
  id: APERTURE_INSTALL_DEFAULT_TYPE_ID,
  name: "Default",
  psi_w_mk: 0.052,
  source: "opt_apit_src_program_default",
  has_pdf: false,
};

function singleElement() {
  return apertureEntry({
    id: "apt_a",
    elements: [
      apertureElement({
        id: "aptel_1",
        installs: { top: "apit_sill", right: null, bottom: null, left: null },
      }),
    ],
  });
}

describe("installsDraftIsDirty", () => {
  test("an untouched draft is clean, any staged edit is dirty", () => {
    expect(installsDraftIsDirty(EMPTY_INSTALLS_DRAFT)).toBe(false);
    expect(
      installsDraftIsDirty(stageInstall(EMPTY_INSTALLS_DRAFT, "aptel_1", "left", "apit_sill")),
    ).toBe(true);
  });
});

describe("draftApertureEntry", () => {
  test("staged assignments show in the key view without touching the source", () => {
    const aperture = singleElement();
    const draft = stageInstall(EMPTY_INSTALLS_DRAFT, "aptel_1", "left", "apit_sill");
    expect(draftApertureEntry(aperture, draft).elements[0]!.installs).toMatchObject({
      top: "apit_sill",
      left: "apit_sill",
    });
    expect(aperture.elements[0]!.installs.left).toBeNull();
  });
});

describe("draftInstallTypes", () => {
  test("staged creates append and staged patches overlay, Ψ only when edited", () => {
    let draft = stageTypeCreate(EMPTY_INSTALLS_DRAFT, {
      id: "apit_new",
      name: "Jamb",
      psiWmk: 0.02,
    });
    draft = stageTypeEdit(draft, APERTURE_INSTALL_DEFAULT_TYPE_ID, "House default", null, false);
    const types = draftInstallTypes([DEFAULT_TYPE], draft);

    expect(types).toHaveLength(2);
    expect(types[0]).toMatchObject({ name: "House default", psi_w_mk: 0.052 });
    expect(types[1]).toMatchObject({ id: "apit_new", name: "Jamb", psi_w_mk: 0.02 });
  });

  test("editing a staged create folds into the insert instead of patching", () => {
    let draft = stageTypeCreate(EMPTY_INSTALLS_DRAFT, {
      id: "apit_new",
      name: "Jamb",
      psiWmk: 0.02,
    });
    draft = stageTypeEdit(draft, "apit_new", "Jamb (foam)", 0.015, true);

    expect(draft.patches.size).toBe(0);
    expect(draft.creates).toEqual([{ id: "apit_new", name: "Jamb (foam)", psiWmk: 0.015 }]);
  });
});

describe("installsDraftCommands", () => {
  test("only edges that actually differ become commands, copy-to goes last", () => {
    const aperture = singleElement();
    let draft = stageInstall(EMPTY_INSTALLS_DRAFT, "aptel_1", "top", "apit_sill"); // no-op
    draft = stageInstall(draft, "aptel_1", "left", "apit_sill");
    draft = { ...draft, copyTargets: ["apt_b"] };

    expect(installsDraftCommands(aperture, draft)).toEqual([
      {
        kind: "setElementInstall",
        aperture_type_id: "apt_a",
        element_id: "aptel_1",
        side: "left",
        install_type_id: "apit_sill",
      },
      {
        kind: "copyElementInstalls",
        source_aperture_id: "apt_a",
        target_aperture_ids: ["apt_b"],
      },
    ]);
  });

  test("painting every perimeter edge with one type collapses to the bulk command", () => {
    const aperture = singleElement();
    let draft = EMPTY_INSTALLS_DRAFT;
    for (const side of ["top", "right", "bottom", "left"] as const) {
      draft = stageInstall(draft, "aptel_1", side, "apit_sill");
    }
    expect(installsDraftCommands(aperture, draft)).toEqual([
      {
        kind: "applyInstallToApertures",
        aperture_ids: ["apt_a"],
        install_type_id: "apit_sill",
      },
    ]);
  });

  test("clearing an assigned edge back to inherit is a null command", () => {
    const draft = stageInstall(EMPTY_INSTALLS_DRAFT, "aptel_1", "top", null);
    expect(installsDraftCommands(singleElement(), draft)).toMatchObject([
      { side: "top", install_type_id: null },
    ]);
  });
});
