import { describe, expect, it } from "vitest";
import {
  applyJournaledEnvelopeCommand,
  isJournaledEnvelopeCommand,
  journaledEnvelopeRowIds,
  JOURNALED_MATERIAL_FIELDS,
} from "../command-journal";
import type { EnvelopeCommand, EnvelopeReadResponse, ProjectMaterial } from "../types";

const material = (overrides: Partial<ProjectMaterial> = {}): ProjectMaterial => ({
  id: "pmat_a",
  name: "Wood fiber board",
  category: "Insulation",
  density_kg_m3: 160,
  specific_heat_j_kgk: 2100,
  conductivity_w_mk: 0.038,
  emissivity: 0.9,
  air_permeance_l_s_m2_at_75pa: null,
  vapor_diffusion_resistance_mu: null,
  vapor_sd_equivalent_m: null,
  color: null,
  source: null,
  url: null,
  comments: null,
  specification_status: "needed",
  datasheet_asset_ids: [],
  catalog_origin: null,
  use_sites: [],
  ...overrides,
});

const slice = (materials: ProjectMaterial[]): EnvelopeReadResponse => ({
  project_id: "proj",
  version_id: "ver",
  source: "draft",
  version_etag: "version-etag",
  draft_etag: "draft-etag",
  saved_assembly_count: 0,
  assemblies: [],
  project_materials: materials,
});

describe("isJournaledEnvelopeCommand", () => {
  it("accepts a command carrying only fields the client can apply exactly", () => {
    expect(
      isJournaledEnvelopeCommand({
        kind: "update_project_material",
        project_material_id: "pmat_a",
        specification_status: "complete",
      }),
    ).toBe(true);
    expect(
      isJournaledEnvelopeCommand({
        kind: "update_project_material",
        project_material_id: "pmat_a",
        datasheet_not_required: true,
      }),
    ).toBe(true);
  });

  // A catalog field would make the server add a `local_overrides` entry the
  // client does not mirror, so those edits stay on the awaited path.
  it("rejects a command that also moves a catalog field", () => {
    expect(
      isJournaledEnvelopeCommand({
        kind: "update_project_material",
        project_material_id: "pmat_a",
        specification_status: "complete",
        conductivity_w_mk: 0.04,
      }),
    ).toBe(false);
  });

  it("rejects a command with no journaled field and every structural kind", () => {
    expect(
      isJournaledEnvelopeCommand({
        kind: "update_project_material",
        project_material_id: "pmat_a",
      }),
    ).toBe(false);
    const structural: EnvelopeCommand = { kind: "create_assembly", name: "WALL-C3", type: "wall" };
    expect(isJournaledEnvelopeCommand(structural)).toBe(false);
  });

  it("ignores keys explicitly set to undefined", () => {
    expect(
      isJournaledEnvelopeCommand({
        kind: "update_project_material",
        project_material_id: "pmat_a",
        specification_status: "complete",
        name: undefined,
      }),
    ).toBe(true);
  });
});

describe("applyJournaledEnvelopeCommand", () => {
  it("patches only the targeted row and leaves the rest identical", () => {
    const other = material({ id: "pmat_b" });
    const before = slice([material(), other]);
    const after = applyJournaledEnvelopeCommand(before, {
      kind: "update_project_material",
      project_material_id: "pmat_a",
      specification_status: "complete",
    });
    expect(after.project_materials[0]?.specification_status).toBe("complete");
    expect(after.project_materials[0]?.conductivity_w_mk).toBe(0.038);
    expect(after.project_materials[1]).toBe(other);
    expect(before.project_materials[0]?.specification_status).toBe("needed");
  });

  it("returns the same slice when the row is gone", () => {
    const before = slice([material()]);
    expect(
      applyJournaledEnvelopeCommand(before, {
        kind: "update_project_material",
        project_material_id: "pmat_missing",
        specification_status: "complete",
      }),
    ).toBe(before);
  });
});

describe("journaledEnvelopeRowIds", () => {
  it("collects every row a journaled command could target", () => {
    expect(journaledEnvelopeRowIds(slice([material(), material({ id: "pmat_b" })]))).toEqual(
      new Set(["pmat_a", "pmat_b"]),
    );
  });
});

// The whole safety argument for journaling — and for skipping the thermal,
// U-value and drift refetches that a real value change needs — is that these
// fields are documentation metadata: not catalog-override fields, and not
// inputs to any derived number. Nothing in the type system says so, so this
// pins the list. Changing it means re-checking
// `PROJECT_MATERIAL_OVERRIDE_FIELDS` / `_PROJECT_GLAZING_OVERRIDE_FIELDS` /
// `_PROJECT_FRAME_OVERRIDE_FIELDS` on the backend and the invalidation gates
// in `command-cache.ts` and `useApertureCommandJournal.ts`.
// `backend/tests/envelope/test_envelope_commands_materials.py`
// ::test_journaled_evidence_fields_are_not_catalog_overrides holds the other
// side of the pin.
describe("journaled field allowlist", () => {
  it("is exactly the documentation-metadata fields", () => {
    expect([...JOURNALED_MATERIAL_FIELDS]).toEqual([
      "specification_status",
      "datasheet_not_required",
    ]);
  });
});
