import { Edges, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MeshStandardMaterial } from "three";
import {
  materialKey,
  VIEWER_APERTURE_EDGE_COLOR,
  VIEWER_DUCT_EXHAUST_COLOR,
  VIEWER_DUCT_SUPPLY_COLOR,
  VIEWER_FACE_EDGE_COLOR,
  VIEWER_GHOST_EDGE_COLOR,
  VIEWER_HIGHLIGHT_FALLBACK,
  VIEWER_LINE_HOVER_COLOR,
  VIEWER_PIPE_DISTRIBUTION_COLOR,
  VIEWER_PIPE_RECIRC_COLOR,
  VIEWER_SPACE_EDGE_COLOR,
} from "../lib/colors";
import { isClickWithinDragTolerance, type PointerPoint } from "../lib/selection";
import type { BuildingModel, BuildingRenderable, LineRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectType, ModelViewerLens } from "../types";

type BuildingLensProps = {
  model: BuildingModel;
  materials: Map<string, MeshStandardMaterial>;
  ghostMaterial: MeshStandardMaterial;
};

const LENS_FADE_SECONDS = 0.18;

export function BuildingLens({ model, materials, ghostMaterial }: BuildingLensProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const layers = useLensFade(lens);
  const objectsByLens = useMemo(() => groupObjectsByLens(model.objects), [model.objects]);
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
            {activeObjects.map((object) =>
              object.kind === "mesh" ? (
                <MeshObject
                  key={object.id}
                  object={object}
                  materials={materials}
                  opacity={layer.opacity}
                  interactive={layer.lens === lens}
                />
              ) : (
                <LineObject
                  key={object.id}
                  object={object}
                  opacity={layer.opacity}
                  interactive={layer.lens === lens}
                />
              ),
            )}
          </group>
        );
      })}
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

const MeshObject = memo(function MeshObject({
  object,
  materials,
  opacity,
  interactive,
}: {
  object: BuildingRenderable;
  materials: Map<string, MeshStandardMaterial>;
  opacity: number;
  interactive: boolean;
}) {
  const pointerDown = useRef<PointerPoint | null>(null);
  const isHovered = useModelViewerStore((state) => state.hoverId === object.id);
  const isSelected = useModelViewerStore((state) => state.selectionId === object.id);
  const material = useOpacityMaterial(
    materialForObject(object.meta.type, isHovered, isSelected, materials),
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

function useOpacityMaterial(material: MeshStandardMaterial, opacity: number): MeshStandardMaterial {
  const faded = useMemo(() => {
    const clone = material.clone();
    clone.transparent = true;
    return clone;
  }, [material]);

  useEffect(() => {
    faded.opacity = material.opacity * opacity;
    faded.depthWrite = opacity >= 0.98;
    faded.needsUpdate = true;
  }, [faded, material.opacity, opacity]);

  useEffect(() => {
    return () => {
      faded.dispose();
    };
  }, [faded]);

  return faded;
}

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
  type: ModelObjectType,
  isHovered: boolean,
  isSelected: boolean,
  materials: Map<string, MeshStandardMaterial>,
): MeshStandardMaterial {
  const state = isSelected ? "selected" : isHovered ? "hovered" : "base";
  const material = materials.get(materialKey(type, state));
  if (!material) throw new Error(`Missing material for ${type}:${state}`);
  return material;
}

function edgeColorForObject(type: ModelObjectType, isSelected: boolean): string {
  if (isSelected) return VIEWER_HIGHLIGHT_FALLBACK;
  if (type === "apertureMeshFace") return VIEWER_APERTURE_EDGE_COLOR;
  if (type === "spaceGroup" || type === "spaceFloorSegmentMeshFace") return VIEWER_SPACE_EDGE_COLOR;
  return VIEWER_FACE_EDGE_COLOR;
}

function lineColor(style: LineRenderable["lineStyle"], isHovered: boolean): string {
  if (isHovered) return VIEWER_LINE_HOVER_COLOR;
  switch (style) {
    case "duct-supply":
      return VIEWER_DUCT_SUPPLY_COLOR;
    case "duct-exhaust":
      return VIEWER_DUCT_EXHAUST_COLOR;
    case "pipe-distribution":
      return VIEWER_PIPE_DISTRIBUTION_COLOR;
    case "pipe-recirc":
      return VIEWER_PIPE_RECIRC_COLOR;
  }
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
