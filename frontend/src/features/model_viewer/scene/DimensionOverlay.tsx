import { Html, Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box3, Camera, Vector3 } from "three";
import { useUnitPreference } from "../../../lib/units";
import { VIEWER_HIGHLIGHT_FALLBACK } from "../lib/colors";
import {
  buildDimensionLineGeometry,
  dimensionOffsetDistance,
  type DimensionLineGeometry,
} from "../lib/dimensionLines";
import { formatMetersAsLength } from "../lib/fieldConfigs";
import type { BuildingModel } from "../loaders/building";
import type { ElementSummary } from "../loaders/lineElements";
import { SCENE_HTML_Z_INDEX_RANGE } from "./htmlLayering";

type DimensionOverlayProps = {
  model: BuildingModel;
  element: ElementSummary;
};

type DimensionSegment = {
  id: string;
  start: Vector3;
  end: Vector3;
};

type DimensionItem = DimensionSegment & {
  geometry: DimensionLineGeometry;
};

export function DimensionOverlay({ model, element }: DimensionOverlayProps) {
  const { camera, invalidate } = useThree();
  const { unitSystem } = useUnitPreference();
  const segments = useMemo(() => segmentsForElement(model, element), [model, element]);
  const offsetDistance = useMemo(
    () => dimensionOffsetDistance(elementDiagonal(segments)),
    [segments],
  );
  const [items, setItems] = useState<DimensionItem[]>(() =>
    buildItems(segments, camera, offsetDistance),
  );
  const lastViewDirection = useRef(new Vector3());

  useEffect(() => {
    setItems(buildItems(segments, camera, offsetDistance));
    camera.getWorldDirection(lastViewDirection.current);
    invalidate();
  }, [camera, invalidate, offsetDistance, segments]);

  useFrame(() => {
    const nextViewDirection = new Vector3();
    camera.getWorldDirection(nextViewDirection);
    if (nextViewDirection.distanceToSquared(lastViewDirection.current) < 1e-8) return;
    lastViewDirection.current.copy(nextViewDirection);
    setItems(buildItems(segments, camera, offsetDistance));
  });

  if (items.length === 0) return null;

  return (
    <group name="dimension-overlay">
      {items.map((item) => (
        <DimensionAnnotation key={item.id} item={item} unitSystem={unitSystem} />
      ))}
    </group>
  );
}

function DimensionAnnotation({
  item,
  unitSystem,
}: {
  item: DimensionItem;
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"];
}) {
  const lines = [
    item.geometry.extensionA,
    item.geometry.extensionB,
    item.geometry.dimensionLine,
    item.geometry.tickA,
    item.geometry.tickB,
  ];

  return (
    <>
      {lines.map((points, index) => (
        <Line
          key={`${item.id}:${index}`}
          points={points}
          color={VIEWER_HIGHLIGHT_FALLBACK}
          lineWidth={0.9}
          transparent
          opacity={0.66}
          depthTest={false}
        />
      ))}
      <Html
        position={item.geometry.midpoint}
        center
        className="model-dimension-label"
        pointerEvents="none"
        zIndexRange={SCENE_HTML_Z_INDEX_RANGE}
      >
        {formatMetersAsLength(item.geometry.lengthM, unitSystem)}
      </Html>
    </>
  );
}

function buildItems(
  segments: DimensionSegment[],
  camera: Camera,
  offsetDistance: number,
): DimensionItem[] {
  const viewDirection = new Vector3();
  camera.getWorldDirection(viewDirection);
  return segments.map((segment) => ({
    ...segment,
    geometry: buildDimensionLineGeometry(segment.start, segment.end, viewDirection, offsetDistance),
  }));
}

function segmentsForElement(model: BuildingModel, element: ElementSummary): DimensionSegment[] {
  return element.segmentIds.flatMap((id) => {
    const vertices = model.metaById.get(id)?.vertices;
    const start = vertices?.[0];
    const end = vertices?.[1];
    if (!start || !end) return [];
    return [
      {
        id,
        start: new Vector3(...start),
        end: new Vector3(...end),
      },
    ];
  });
}

function elementDiagonal(segments: DimensionSegment[]): number {
  const bounds = new Box3();
  for (const segment of segments) {
    bounds.expandByPoint(segment.start);
    bounds.expandByPoint(segment.end);
  }
  return bounds.isEmpty() ? 1 : bounds.getSize(new Vector3()).length();
}
