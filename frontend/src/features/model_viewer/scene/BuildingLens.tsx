import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  VIEWER_HIGHLIGHT_FALLBACK,
  VIEWER_LINE_HOVER_COLOR,
  type GhostMaterials,
  type ViewerTokens,
} from "../lib/colors";
import { isClickWithinDragTolerance, pointerPoint, type PointerPoint } from "../lib/selection";
import { lineStyleDefinition } from "../lib/themes";
import type { BuildingModel, GhostGeometry, LineRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens } from "../types";
import { BatchedLens } from "./BatchedLens";
import { MeasureOverlay } from "./MeasureOverlay";
import { SiteSunLayer } from "./SiteSunLayer";

type BuildingLensProps = {
  model: BuildingModel;
  ghostMaterials: GhostMaterials;
  tokens: ViewerTokens;
};

/** Lenses that render on the batched substrate (`BatchedLens`). site-sun also
 *  draws its overlays (shades/compass/sun-path) via `SiteSunLayer`; the line
 *  lenses (ventilation/hot-water) keep per-object `<Line>`s (D-6). */
const BATCHED_MESH_LENSES = new Set<ModelViewerLens>([
  "building",
  "spaces",
  "floor-areas",
  "site-sun",
]);

export function BuildingLens({ model, ghostMaterials, tokens }: BuildingLensProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  useLineRaycastTolerance();
  // The real building shows on building + site-sun; other lenses get the faint
  // merged ghost for context.
  const showGhost = lens !== "building" && lens !== "site-sun";
  const isBatched = BATCHED_MESH_LENSES.has(lens);
  // Only the line lenses (ventilation/hot-water) take the per-object path (D-6).
  const lineObjects = useMemo(
    () =>
      model.objects.filter(
        (object): object is LineRenderable => object.kind === "line" && object.lens === lens,
      ),
    [model.objects, lens],
  );
  const interactive = !measureActive;

  // The lens switch is a hard cut for now (F1); Phase 04c (D-8) restores the
  // 0.18 s fade as an imperative opacity tween that never reconciles React.
  return (
    <>
      {showGhost ? <GhostBuildingContext ghost={model.ghost} materials={ghostMaterials} /> : null}
      {isBatched ? (
        <BatchedLens model={model} lens={lens} tokens={tokens} />
      ) : (
        <group name={`${lens}-lens`}>
          {lineObjects.map((object) => (
            <LineObject key={object.id} object={object} interactive={interactive} />
          ))}
        </group>
      )}
      {lens === "site-sun" ? <SiteSunLayer model={model} /> : null}
      <MeasureOverlay model={model} />
    </>
  );
}

function GhostBuildingContext({
  ghost,
  materials,
}: {
  ghost: GhostGeometry;
  materials: GhostMaterials;
}) {
  return (
    <group name="building-ghost-context">
      <mesh geometry={ghost.geometry} material={materials.fill} raycast={() => null} />
      <lineSegments geometry={ghost.edges} material={materials.edge} raycast={() => null} />
    </group>
  );
}

const LineObject = memo(function LineObject({
  object,
  interactive,
}: {
  object: LineRenderable;
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
