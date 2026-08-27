import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { applyEnvelopeCommandCacheEffects } from "../command-cache";
import { envelopeQueryKeys } from "../query-keys";
import type { EnvelopeCommand, EnvelopeReadResponse } from "../types";

const PROJECT_ID = "proj";
const VERSION_ID = "ver";

const slice = (draftEtag: string | null): EnvelopeReadResponse => ({
  project_id: PROJECT_ID,
  version_id: VERSION_ID,
  source: "draft",
  version_etag: "version-etag",
  draft_etag: draftEtag,
  saved_assembly_count: 0,
  assemblies: [],
  project_materials: [],
});

function invalidatedKeys(command: EnvelopeCommand): unknown[][] {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(Promise.resolve());
  applyEnvelopeCommandCacheEffects(
    queryClient,
    PROJECT_ID,
    slice("draft-etag-0"),
    slice("draft-etag-1"),
    command,
  );
  return invalidate.mock.calls.map((call) => call[0]?.queryKey as unknown[]);
}

const thermalScope = [...envelopeQueryKeys.all(PROJECT_ID), "thermal"];
const condensationScope = envelopeQueryKeys.condensationScope(PROJECT_ID, VERSION_ID, "draft");

describe("applyEnvelopeCommandCacheEffects", () => {
  // The reported symptom is a status pass down the column; each click used to
  // invalidate thermal and condensation for every assembly (PRD S-5).
  it("does not touch thermal or condensation for a status-only material edit", () => {
    const keys = invalidatedKeys({
      kind: "update_project_material",
      project_material_id: "pmat_a",
      specification_status: "complete",
    });
    expect(keys).not.toContainEqual(thermalScope);
    expect(keys).not.toContainEqual(condensationScope);
    // The evidence rollups the status *does* move are still refreshed.
    expect(keys).toContainEqual(envelopeQueryKeys.materialDrift(PROJECT_ID, VERSION_ID, "draft"));
  });

  it("still invalidates both when a thermal field moves", () => {
    const keys = invalidatedKeys({
      kind: "update_project_material",
      project_material_id: "pmat_a",
      conductivity_w_mk: 0.04,
    });
    expect(keys).toContainEqual(thermalScope);
    expect(keys).toContainEqual(condensationScope);
  });

  it("still invalidates both when a vapour field moves", () => {
    const keys = invalidatedKeys({
      kind: "update_project_material",
      project_material_id: "pmat_a",
      vapor_diffusion_resistance_mu: 3,
    });
    expect(keys).toContainEqual(thermalScope);
    expect(keys).toContainEqual(condensationScope);
  });

  it("leaves other command kinds broad", () => {
    const keys = invalidatedKeys({ kind: "delete_assembly", assembly_id: "asm_a" });
    expect(keys).toContainEqual(thermalScope);
    expect(keys).toContainEqual(condensationScope);
  });
});
