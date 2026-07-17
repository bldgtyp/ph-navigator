import { afterEach, describe, expect, test } from "vitest";
import { DEFAULT_MODEL_VIEWER_THEMES, parseModelViewerTheme } from "../lib/themeState";
import {
  constructionColor,
  cyrb53,
  legendForModel,
  ventilationAirflowCategory,
  ventilationUnitColor,
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
    measureActive: false,
    measureSnap: null,
    measurePendingPoint: null,
    measureLines: [],
    section: null,
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
    // Item 14: Floor Areas now offers the Airflow mode (Spaces already did).
    expect(parseModelViewerTheme("floor-areas", "ventilation-airflow")).toBe("ventilation-airflow");
    // Item 15: Ventilation Unit mode is offered on both space lenses.
    expect(parseModelViewerTheme("spaces", "ventilation-unit")).toBe("ventilation-unit");
    expect(parseModelViewerTheme("floor-areas", "ventilation-unit")).toBe("ventilation-unit");
    expect(parseModelViewerTheme("building", "ventilation-unit")).toBe("shaded");
  });

  test("colors spaces by ventilation unit with stable hashed hues (Item 15)", () => {
    const ervA = ventilationUnitColor("erv-a-uuid", "ERV A");
    // Stable: same id → identical color; keyed by id, labeled by name.
    expect(ventilationUnitColor("erv-a-uuid", "ERV A")).toEqual(ervA);
    expect(ervA.key).toBe("erv-a-uuid");
    expect(ervA.label).toBe("ERV A");
    // Distinct units get distinct colors.
    expect(ventilationUnitColor("erv-b-uuid", "ERV B").color).not.toBe(ervA.color);
    // Unassigned spaces fall to a neutral grey bucket.
    expect(ventilationUnitColor(null, null)).toEqual({
      key: "__unassigned__",
      label: "Unassigned",
      color: "#C8C8C8",
    });
  });

  test("builds a per-unit Ventilation Unit legend (Item 15)", () => {
    const model = {
      objects: [
        mesh("space:1", "spaces", "spaceGroup", { ventUnit: { id: "erv-a", name: "ERV A" } }),
        mesh("space:2", "spaces", "spaceGroup", { ventUnit: { id: "erv-a", name: "ERV A" } }),
        mesh("space:3", "spaces", "spaceGroup", { ventUnit: { id: "erv-b", name: "ERV B" } }),
        mesh("space:4", "spaces", "spaceGroup", {}),
      ],
    } as unknown as BuildingModel;

    const legend = legendForModel(model, "spaces", "ventilation-unit");
    expect(legend?.title).toBe("Ventilation Unit");
    // Alphabetized by label; each unit counted; unassigned included.
    expect(legend?.rows.map((row) => [row.id, row.label, row.count])).toEqual([
      ["erv-a", "ERV A", 2],
      ["erv-b", "ERV B", 1],
      ["__unassigned__", "Unassigned", 1],
    ]);
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

  test("colors floor-area segments by ventilation airflow (Item 14)", () => {
    const model = {
      objects: [
        mesh("floor:sup", "floor-areas", "spaceFloorSegmentMeshFace", {
          airflow: { sup: 0.01, eta: null },
        }),
        mesh("floor:eta", "floor-areas", "spaceFloorSegmentMeshFace", {
          airflow: { sup: null, eta: 0.02 },
        }),
      ],
    } as unknown as BuildingModel;

    expect(legendForModel(model, "floor-areas", "ventilation-airflow")).toEqual({
      title: "Ventilation Airflow",
      kind: "theme",
      rows: [
        { id: "SupplyOnly", label: "Supply Only", color: "#8CCEFE", count: 1 },
        { id: "ExtractOnly", label: "Extract Only", color: "#FE8C8C", count: 1 },
      ],
    });
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
  options: {
    boundary?: string;
    weightingFactor?: number;
    airflow?: { sup?: number | null; eta?: number | null };
    ventUnit?: { id?: string | null; name?: string | null };
  },
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
      airflow: options.airflow
        ? { _v_sup: options.airflow.sup ?? null, _v_eta: options.airflow.eta ?? null }
        : null,
      ventilation_unit_id: options.ventUnit?.id ?? null,
      ventilation_unit_name: options.ventUnit?.name ?? null,
    },
  };
}

function line(id: string, lens: string, lineStyle: string) {
  return { id, lens, kind: "line", lineStyle };
}
