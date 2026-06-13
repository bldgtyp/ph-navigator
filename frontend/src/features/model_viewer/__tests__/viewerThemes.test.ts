import { afterEach, describe, expect, test } from "vitest";
import {
  DEFAULT_MODEL_VIEWER_THEMES,
  constructionColor,
  cyrb53,
  legendForModel,
  parseModelViewerTheme,
  ventilationAirflowCategory,
  weightingFactorCategory,
} from "../lib/themes";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";

afterEach(() => {
  useModelViewerStore.setState({
    activeFileId: null,
    lens: "building",
    themesByLens: { ...DEFAULT_MODEL_VIEWER_THEMES },
    hoverId: null,
    selectionId: null,
    loadPhase: "idle",
    errorKind: null,
    cameraRequest: null,
  });
});

describe("model viewer themes", () => {
  test("parses theme URL tokens against the active lens", () => {
    expect(parseModelViewerTheme("building", "boundary")).toBe("boundary");
    expect(parseModelViewerTheme("building", "ventilation-airflow")).toBe("shaded");
    expect(parseModelViewerTheme("floor-areas", "bad-token")).toBe("weighting-factor");
  });

  test("pins the V1 construction color hash algorithm", () => {
    expect(cyrb53("N.3.1")).toBe(2195287024197316);
    expect(constructionColor("N.3.1").color).toBe("#d9f1a9");
    expect(constructionColor("N.3.2").color).not.toBe(constructionColor("N.3.1").color);
  });

  test("categorizes floor weighting factors at the V2 bucket boundaries", () => {
    expect([0, 0.15, 0.3, 0.45, 0.5, 0.55, 0.6, 1].map(weightingFactorCategory)).toEqual([
      "NonTreated",
      "Minimal",
      "Partial",
      "Partial",
      "Semi",
      "Semi",
      "FullyTreated",
      "FullyTreated",
    ]);
  });

  test("categorizes ventilation airflow with m3/s wire values", () => {
    expect(ventilationAirflowCategory(0.01, null)).toBe("SupplyOnly");
    expect(ventilationAirflowCategory(null, 0.01)).toBe("ExtractOnly");
    expect(ventilationAirflowCategory(0.01, 0.02)).toBe("SupplyAndExtract");
    expect(ventilationAirflowCategory(0, 0)).toBe("NoVentilation");
  });

  test("computes theme and mini-key legend counts from model metadata", () => {
    const model = legendModel();

    expect(legendForModel(model, "building", "boundary")).toEqual({
      title: "Boundary",
      kind: "theme",
      rows: [
        { id: "Outdoors", label: "Outdoors", color: "#40B4FF", count: 1 },
        { id: "Ground", label: "Ground", color: "#A55200", count: 1 },
      ],
    });
    expect(legendForModel(model, "floor-areas", "weighting-factor")?.rows).toEqual([
      { id: "FullyTreated", label: "Fully Treated", color: "#F5E470", count: 1 },
    ]);
    expect(legendForModel(model, "ventilation", "shaded")?.rows).toEqual([
      { id: "duct-supply", label: "Supply", color: "#2674d9", count: 1 },
      { id: "duct-exhaust", label: "Exhaust", color: "#d94a3a", count: 1 },
    ]);
    expect(legendForModel(model, "building", "shaded")).toBeNull();
  });

  test("resets theme on lens switch but preserves selection on theme switch", () => {
    const store = useModelViewerStore.getState();
    store.setTheme("building", "boundary");
    store.setSelectionId("face:wall-1");
    store.setTheme("building", "construction");
    expect(useModelViewerStore.getState().selectionId).toBe("face:wall-1");
    expect(useModelViewerStore.getState().themesByLens.building).toBe("construction");

    store.setLens("floor-areas");
    const next = useModelViewerStore.getState();
    expect(next.selectionId).toBeNull();
    expect(next.themesByLens["floor-areas"]).toBe("weighting-factor");
  });

  test("hydrates same-lens URL theme without clearing selection", () => {
    const store = useModelViewerStore.getState();
    store.setSelectionId("face:wall-1");
    store.setUrlViewState("building", "boundary");
    const state = useModelViewerStore.getState();
    expect(state.selectionId).toBe("face:wall-1");
    expect(state.lens).toBe("building");
    expect(state.themesByLens.building).toBe("boundary");
  });
});

function legendModel(): BuildingModel {
  return {
    objects: [
      mesh("face:outdoors", "building", "faceMesh", { boundary: "Outdoors" }),
      mesh("face:ground", "building", "faceMesh", { boundary: "Ground" }),
      mesh("floor:1", "floor-areas", "spaceFloorSegmentMeshFace", { weightingFactor: 1 }),
      line("duct:1", "ventilation", "duct-supply"),
      line("duct:2", "ventilation", "duct-exhaust"),
    ],
  } as unknown as BuildingModel;
}

function mesh(
  id: string,
  lens: string,
  type: string,
  options: { boundary?: string; weightingFactor?: number },
) {
  return {
    id,
    lens,
    kind: "mesh",
    meta: {
      id,
      type,
      identifier: id,
      display_name: id,
      face_type: "Wall",
      boundary_condition: options.boundary ? { type: options.boundary } : null,
      area: null,
      properties: { energy: { construction: { identifier: "WALL-C3" } } },
      vertices: [],
      weighting_factor: options.weightingFactor,
    },
  };
}

function line(id: string, lens: string, lineStyle: string) {
  return { id, lens, kind: "line", lineStyle };
}
