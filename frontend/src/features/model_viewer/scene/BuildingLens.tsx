import { Edges, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, MeshBasicMaterial } from "three";
import type { MeshStandardMaterial } from "three";
import {
  materialKey,
  VIEWER_APERTURE_EDGE_COLOR,
  VIEWER_FACE_EDGE_COLOR,
  VIEWER_GHOST_EDGE_COLOR,
  VIEWER_HIGHLIGHT_FALLBACK,
  VIEWER_LINE_HOVER_COLOR,
  VIEWER_SHADE_COLOR,
  VIEWER_SPACE_EDGE_COLOR,
} from "../lib/colors";
import { isClickWithinDragTolerance, type PointerPoint } from "../lib/selection";
import { colorForThemedObject, isThemeAllowedForLens, lineStyleDefinition } from "../lib/themes";
import type { BuildingModel, BuildingRenderable, LineRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectMeta, ModelObjectType, ModelViewerLens, ModelViewerTheme } from "../types";
import { MeasureOverlay } from "./MeasureOverlay";
import { SiteSunLayer } from "./SiteSunLayer";
import { useOpacityMaterial, type ViewerMeshMaterial } from "./useOpacityMaterial";

type BuildingLensProps = {
  model: BuildingModel;
  materials: Map<string, MeshStandardMaterial>;
  ghostMaterial: MeshStandardMaterial;
};

const LENS_FADE_SECONDS = 0.18;

export function BuildingLens({ model, materials, ghostMaterial }: BuildingLensProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const layers = useLensFade(lens);
  const objectsByLens = useMemo(() => groupObjectsByLens(model.objects), [model.objects]);
  const themeMaterials = useMemo(
    () => createThemeMaterials(model, lens, theme),
    [lens, model, theme],
  );
  useEffect(() => {
    return () => {
      for (const material of themeMaterials.values()) {
        material.dispose();
      }
    };
  }, [themeMaterials]);
  const shadeMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: VIEWER_SHADE_COLOR,
        side: DoubleSide,
        transparent: true,
        opacity: 0.48,
      }),
    [],
  );
  useEffect(() => () => shadeMaterial.dispose(), [shadeMaterial]);
  useLineRaycastTolerance();
  const showGhost = lens !== "building" && lens !== "site-sun";

  return (
    <>
      {showGhost ? (
        <GhostBuildingContext objects={model.buildingObjects} material={ghostMaterial} />
      ) : null}
      {layers.map((layer) => {
        const activeObjects = objectsByLens.get(layer.lens) ?? [];
        return (
          <group key={layer.lens} name={`${layer.lens}-lens`}>
            {layer.lens === "site-sun" ? (
              <SiteSunLayer
                model={model}
                materials={materials}
                themeMaterials={themeMaterials}
                theme={theme}
                opacity={layer.opacity}
                interactive={layer.lens === lens && !measureActive}
                shadeMaterial={shadeMaterial}
              />
            ) : (
              activeObjects.map((object) =>
                object.kind === "mesh" ? (
                  <MeshObject
                    key={object.id}
                    object={object}
                    materials={materials}
                    themeMaterials={themeMaterials}
                    lens={lens}
                    theme={theme}
                    opacity={layer.opacity}
                    interactive={layer.lens === lens && !measureActive}
                  />
                ) : (
                  <LineObject
                    key={object.id}
                    object={object}
                    opacity={layer.opacity}
                    interactive={layer.lens === lens && !measureActive}
                  />
                ),
              )
            )}
          </group>
        );
      })}
      <MeasureOverlay model={model} />
    </>
  );
}

function useLensFade(lens: ModelViewerLens): { lens: ModelViewerLens; opacity: number }[] {
  const { invalidate } = useThree();
  const previousLens = useRef<ModelViewerLens | null>(null);
  const activeLens = useRef<ModelViewerLens>(lens);
  const fadeProgress = useRef(1);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (activeLens.current === lens) return;
    previousLens.current = activeLens.current;
    activeLens.current = lens;
    fadeProgress.current = 0;
    setTick((value) => value + 1);
    invalidate();
  }, [invalidate, lens]);

  useFrame((_, delta) => {
    if (!previousLens.current) return;
    fadeProgress.current = Math.min(1, fadeProgress.current + delta / LENS_FADE_SECONDS);
    if (fadeProgress.current >= 1) {
      previousLens.current = null;
    }
    setTick((value) => value + 1);
    invalidate();
  });

  const active = { lens: activeLens.current, opacity: fadeProgress.current };
  return previousLens.current
    ? [{ lens: previousLens.current, opacity: 1 - fadeProgress.current }, active]
    : [{ lens: activeLens.current, opacity: 1 }];
}

function groupObjectsByLens(
  objects: BuildingModel["objects"],
): Map<ModelViewerLens, BuildingModel["objects"]> {
  const groups = new Map<ModelViewerLens, BuildingModel["objects"]>();
  for (const object of objects) {
    const group = groups.get(object.lens);
    if (group) {
      group.push(object);
    } else {
      groups.set(object.lens, [object]);
    }
  }
  return groups;
}

function GhostBuildingContext({
  objects,
  material,
}: {
  objects: BuildingRenderable[];
  material: MeshStandardMaterial;
}) {
  return (
    <group name="building-ghost-context">
      {objects.map((object) =>
        object.geometries.map((geometry) => (
          <mesh
            key={`${object.id}:ghost:${geometry.uuid}`}
            geometry={geometry}
            material={material}
            raycast={() => null}
          >
            <Edges threshold={12} color={VIEWER_GHOST_EDGE_COLOR} />
          </mesh>
        )),
      )}
    </group>
  );
}

export const MeshObject = memo(function MeshObject({
  object,
  materials,
  themeMaterials,
  lens,
  theme,
  opacity,
  interactive,
}: {
  object: BuildingRenderable;
  materials: Map<string, MeshStandardMaterial>;
  themeMaterials: Map<string, MeshBasicMaterial>;
  lens: ModelViewerLens;
  theme: ModelViewerTheme;
  opacity: number;
  interactive: boolean;
}) {
  const pointerDown = useRef<PointerPoint | null>(null);
  const isHovered = useModelViewerStore((state) => state.hoverId === object.id);
  const isSelected = useModelViewerStore((state) => state.selectionId === object.id);
  const material = useOpacityMaterial(
    materialForObject(object.meta, lens, theme, isHovered, isSelected, materials, themeMaterials),
    opacity,
  );
  const edgeColor = edgeColorForObject(object.meta.type, isSelected);

  return (
    <group name={object.meta.display_name}>
      {object.geometries.map((geometry) => (
        <mesh
          key={`${object.id}:${geometry.uuid}`}
          geometry={geometry}
          material={material}
          castShadow
          receiveShadow
          onPointerDown={(event) => {
            if (!interactive) return;
            pointerDown.current = pointerPoint(event);
          }}
          onPointerOver={(event) => interactive && handlePointerOver(event, object.id)}
          onPointerOut={(event) => interactive && handlePointerOut(event)}
          onClick={(event) => interactive && selectObject(event, pointerDown.current, object.id)}
          onDoubleClick={(event) => interactive && zoomToObject(event, object.id)}
          userData={{ modelObjectId: object.id, meta: object.meta }}
        >
          <Edges threshold={12} color={edgeColor} />
        </mesh>
      ))}
    </group>
  );
});

const LineObject = memo(function LineObject({
  object,
  opacity,
  interactive,
}: {
  object: LineRenderable;
  opacity: number;
  interactive: boolean;
}) {
  const pointerDown = useRef<PointerPoint | null>(null);
  const isHovered = useModelViewerStore((state) => state.hoverId === object.id);
  const isSelected = useModelViewerStore((state) => state.selectionId === object.id);

  return (
    <Line
      points={object.points}
      color={isSelected ? VIEWER_HIGHLIGHT_FALLBACK : lineColor(object.lineStyle, isHovered)}
      lineWidth={lineWidth(object.lineStyle, isHovered, isSelected)}
      worldUnits
      transparent
      opacity={opacity}
      dashed={object.lineStyle === "pipe-recirc"}
      dashSize={0.8}
      gapSize={0.35}
      onPointerDown={(event) => {
        if (!interactive) return;
        pointerDown.current = pointerPoint(event);
      }}
      onPointerOver={(event) => interactive && handlePointerOver(event, object.id)}
      onPointerOut={(event) => interactive && handlePointerOut(event)}
      onClick={(event) => interactive && selectObject(event, pointerDown.current, object.id)}
      onDoubleClick={(event) => interactive && zoomToObject(event, object.id)}
      userData={{ modelObjectId: object.id, meta: object.meta }}
    />
  );
});

function useLineRaycastTolerance(): void {
  const { raycaster } = useThree();
  useEffect(() => {
    const params = raycaster.params as typeof raycaster.params & {
      Line2?: { threshold?: number };
      Line?: { threshold?: number };
    };
    params.Line2 = { ...(params.Line2 ?? {}), threshold: 0.55 };
    params.Line = { ...(params.Line ?? {}), threshold: 0.55 };
  }, [raycaster]);
}

function materialForObject(
  meta: ModelObjectMeta,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
  isHovered: boolean,
  isSelected: boolean,
  materials: Map<string, MeshStandardMaterial>,
  themeMaterials: Map<string, MeshBasicMaterial>,
): ViewerMeshMaterial {
  const type = meta.type;
  const state = isSelected ? "selected" : isHovered ? "hovered" : "base";
  if (state === "base") {
    const themeColor = colorForThemedObject(meta, lens, theme);
    if (themeColor) {
      const material = themeMaterials.get(themeColor.color);
      if (!material) throw new Error(`Missing theme material for ${themeColor.color}`);
      return material;
    }
  }
  const material = materials.get(materialKey(type, state));
  if (!material) throw new Error(`Missing material for ${type}:${state}`);
  return material;
}

function createThemeMaterials(
  model: BuildingModel,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): Map<string, MeshBasicMaterial> {
  const palette = new Map<string, MeshBasicMaterial>();
  if (theme === "shaded" || !isThemeAllowedForLens(lens, theme)) return palette;
  for (const object of model.objects) {
    if (object.kind !== "mesh" || object.lens !== lens) continue;
    const themeColor = colorForThemedObject(object.meta, lens, theme);
    if (!themeColor || palette.has(themeColor.color)) continue;
    palette.set(
      themeColor.color,
      new MeshBasicMaterial({ color: themeColor.color, side: DoubleSide }),
    );
  }
  return palette;
}

function edgeColorForObject(type: ModelObjectType, isSelected: boolean): string {
  if (isSelected) return VIEWER_HIGHLIGHT_FALLBACK;
  if (type === "apertureMeshFace") return VIEWER_APERTURE_EDGE_COLOR;
  if (type === "spaceGroup" || type === "spaceFloorSegmentMeshFace") return VIEWER_SPACE_EDGE_COLOR;
  return VIEWER_FACE_EDGE_COLOR;
}

function lineColor(style: LineRenderable["lineStyle"], isHovered: boolean): string {
  if (isHovered) return VIEWER_LINE_HOVER_COLOR;
  return lineStyleDefinition(style).color;
}

function lineWidth(
  style: LineRenderable["lineStyle"],
  isHovered: boolean,
  isSelected: boolean,
): number {
  const base = style.startsWith("duct") ? 0.11 : 0.08;
  return isSelected ? base * 1.8 : isHovered ? base * 1.45 : base;
}

function pointerPoint(event: ThreeEvent<PointerEvent>): PointerPoint {
  return {
    clientX: event.nativeEvent.clientX,
    clientY: event.nativeEvent.clientY,
  };
}

function handlePointerOver(event: ThreeEvent<PointerEvent>, objectId: string): void {
  event.stopPropagation();
  useModelViewerStore.getState().setHoverId(objectId);
}

function handlePointerOut(event: ThreeEvent<PointerEvent>): void {
  event.stopPropagation();
  useModelViewerStore.getState().setHoverId(null);
}

function selectObject(
  event: ThreeEvent<MouseEvent>,
  pointerDown: PointerPoint | null,
  objectId: string,
): void {
  event.stopPropagation();
  const point = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
  if (!isClickWithinDragTolerance(pointerDown, point)) return;
  useModelViewerStore.getState().setSelectionId(objectId);
}

function zoomToObject(event: ThreeEvent<MouseEvent>, objectId: string): void {
  event.stopPropagation();
  const store = useModelViewerStore.getState();
  store.setSelectionId(objectId);
  store.requestCamera("zoomTo", objectId);
}
