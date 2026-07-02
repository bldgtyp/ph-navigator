import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import {
  VIEWER_FILTER_DIM_LINE_COLOR,
  VIEWER_LINE_HOVER_COLOR,
  type GhostMaterials,
  type ViewerTokens,
} from "../lib/colors";
import { isHiddenByFilter } from "../lib/legendFilter";
import { isPointVisibleForSection } from "../lib/section";
import {
  elementIdForSegmentId,
  isClickWithinDragTolerance,
  pointerPoint,
  resolveLineHighlightTier,
  type LineHighlightTier,
  type PointerPoint,
} from "../lib/selection";
import { lineStyleDefinition } from "../lib/themes";
import type { SunVector } from "../lib/sunStudy";
import type { BuildingModel, GhostGeometry, LineRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelViewerLens, ModelViewerTheme, SunPathAndCompassModelData } from "../types";
import { BatchedLens } from "./BatchedLens";
import { DimensionOverlay } from "./DimensionOverlay";
import { MeasureOverlay } from "./MeasureOverlay";
import { SiteSunLayer } from "./SiteSunLayer";

type BuildingLensProps = {
  model: BuildingModel;
  ghostMaterials: GhostMaterials;
  tokens: ViewerTokens;
  sunPath: SunPathAndCompassModelData | null;
  /** The engaged sun-study direction (site-sun lens only), or null. */
  sunStudyVector: SunVector | null;
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

export function BuildingLens({
  model,
  ghostMaterials,
  tokens,
  sunPath,
  sunStudyVector,
}: BuildingLensProps) {
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  useLineRaycastTolerance();
  useClearSelectionWhenHidden(model, lens, theme);
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
  const selectedElement = selectionId ? (model.elementsById.get(selectionId) ?? null) : null;
  const showDimensionOverlay =
    selectedElement !== null && (lens === "ventilation" || lens === "hot-water");

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
            <LineObject
              key={object.id}
              object={object}
              tokens={tokens}
              interactive={interactive}
              hidden={isHiddenByFilter(object, lens, theme, legendFilter)}
            />
          ))}
        </group>
      )}
      {lens === "site-sun" ? (
        <SiteSunLayer model={model} sunPath={sunPath} sunStudyVector={sunStudyVector} />
      ) : null}
      {showDimensionOverlay ? <DimensionOverlay model={model} element={selectedElement} /> : null}
      <MeasureOverlay model={model} />
    </>
  );
}

/** Close the inspector when a newly-applied legend filter dims the selected
 *  object's faces — a wireframe ghost is not the inspected object (PRD §2.8).
 *  Only a filter change can hide the selection (hidden objects are unpickable),
 *  so this watches the filter/lens/theme, reading selection fresh from the store. */
function useClearSelectionWhenHidden(
  model: BuildingModel,
  lens: ModelViewerLens,
  theme: ModelViewerTheme,
): void {
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  useEffect(() => {
    if (!legendFilter) return;
    const { selectionId } = useModelViewerStore.getState();
    if (!selectionId) return;
    const selectedElement = model.elementsById.get(selectionId);
    const selectedObjects = selectedElement
      ? selectedElement.segmentIds
          .map((id) => model.objects.find((candidate) => candidate.id === id))
          .filter((object): object is NonNullable<typeof object> => object !== undefined)
      : model.objects.filter((candidate) => candidate.id === selectionId);
    if (
      selectedObjects.length > 0 &&
      selectedObjects.every((object) => isHiddenByFilter(object, lens, theme, legendFilter))
    ) {
      useModelViewerStore.getState().clearSelection();
    }
  }, [legendFilter, lens, theme, model]);
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
  tokens,
  interactive,
  hidden,
}: {
  object: LineRenderable;
  tokens: ViewerTokens;
  interactive: boolean;
  hidden: boolean;
}) {
  const pointerDown = useRef<PointerPoint | null>(null);
  const tier = useModelViewerStore((state) =>
    resolveLineHighlightTier(object.id, state.selectionId, state.hoverId, state.focusedSegmentId),
  );
  // A legend-filtered line shows as faint context and is non-interactive (events
  // fall through to the lines behind it) — the line-lens analogue of the mesh
  // wireframe context (PRD §5).
  const live = interactive && !hidden;

  return (
    <Line
      points={object.points}
      color={hidden ? VIEWER_FILTER_DIM_LINE_COLOR : lineColor(object.lineStyle, tier, tokens)}
      lineWidth={lineWidth(object.lineStyle, live ? tier : "default")}
      worldUnits
      dashed={object.lineStyle === "pipe-recirc"}
      dashSize={0.8}
      gapSize={0.35}
      onPointerDown={(event) => {
        if (!live) return;
        pointerDown.current = pointerPoint(event);
      }}
      onPointerOver={(event) => live && handlePointerOver(event, object.id)}
      onPointerOut={(event) => live && handlePointerOut(event)}
      onClick={(event) => live && selectObject(event, pointerDown.current, object.id)}
      onDoubleClick={(event) => live && zoomToObject(event, object.id)}
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

function lineColor(
  style: LineRenderable["lineStyle"],
  tier: LineHighlightTier,
  tokens: ViewerTokens,
): string {
  if (tier === "focused") return tokens.highlight;
  if (tier === "selectedSoft") return tokens.highlightSoft;
  if (tier === "hoverElement" || tier === "hoverSegment") return VIEWER_LINE_HOVER_COLOR;
  return lineStyleDefinition(style).color;
}

function lineWidth(style: LineRenderable["lineStyle"], tier: LineHighlightTier): number {
  const base = style.startsWith("duct") ? 0.11 : 0.08;
  switch (tier) {
    case "focused":
      return base * 1.8;
    case "selectedSoft":
      return base * 1.5;
    case "hoverElement":
    case "hoverSegment":
      return base * 1.45;
    case "default":
      return base;
  }
}

function handlePointerOver(event: ThreeEvent<PointerEvent>, objectId: string): void {
  event.stopPropagation();
  if (!isPointVisibleForSection(event.point, useModelViewerStore.getState().section)) return;
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
  if (!isPointVisibleForSection(event.point, useModelViewerStore.getState().section)) return;
  const point = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
  if (!isClickWithinDragTolerance(pointerDown, point)) return;
  const elementId = elementIdForSegmentId(objectId) ?? objectId;
  useModelViewerStore.getState().setSelectionId(elementId);
}

function zoomToObject(event: ThreeEvent<MouseEvent>, objectId: string): void {
  event.stopPropagation();
  if (!isPointVisibleForSection(event.point, useModelViewerStore.getState().section)) return;
  const store = useModelViewerStore.getState();
  const elementId = elementIdForSegmentId(objectId) ?? objectId;
  store.setSelectionId(elementId);
  store.requestCamera("zoomTo", elementId);
}
