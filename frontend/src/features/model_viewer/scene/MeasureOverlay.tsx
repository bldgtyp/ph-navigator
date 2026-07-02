import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3 } from "three";
import { useUnitPreference } from "../../../lib/units";
import { VIEWER_HIGHLIGHT_FALLBACK } from "../lib/colors";
import {
  formatMeasureDistance,
  nearestMeasureSnap,
  type MeasureSnapCandidate,
  type ScreenPoint,
} from "../lib/measure";
import { isClickWithinDragTolerance } from "../lib/selection";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelViewerMeasureLine } from "../types";
import { SCENE_HTML_Z_INDEX_RANGE } from "./htmlLayering";

type MeasureOverlayProps = {
  model: BuildingModel;
};

export function MeasureOverlay({ model }: MeasureOverlayProps) {
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const measureSnap = useModelViewerStore((state) => state.measureSnap);
  const measureLines = useModelViewerStore((state) => state.measureLines);
  const setMeasureSnap = useModelViewerStore((state) => state.setMeasureSnap);
  const commitMeasurePoint = useModelViewerStore((state) => state.commitMeasurePoint);
  const candidates = useMeasureCandidates(model);
  const pointerDown = useRef<ScreenPoint | null>(null);
  const latestPointer = useRef<ScreenPoint | null>(null);
  const frame = useRef<number | null>(null);
  const scratch = useRef(new Vector3());
  const { camera, gl, invalidate } = useThree();
  const { unitSystem } = useUnitPreference();

  useEffect(() => {
    if (!measureActive) return;
    const canvas = gl.domElement;

    const flushPointerMove = () => {
      frame.current = null;
      if (!latestPointer.current) return;
      const rect = canvas.getBoundingClientRect();
      const nextSnap = nearestMeasureSnap(
        candidates,
        latestPointer.current,
        camera,
        rect,
        undefined,
        scratch.current,
      );
      if (useModelViewerStore.getState().measureSnap?.id === nextSnap?.id) return;
      setMeasureSnap(nextSnap);
      invalidate();
    };
    const onPointerDown = (event: PointerEvent) => {
      pointerDown.current = { clientX: event.clientX, clientY: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      latestPointer.current = { clientX: event.clientX, clientY: event.clientY };
      frame.current ??= window.requestAnimationFrame(flushPointerMove);
    };
    const onClick = (event: MouseEvent) => {
      const point = { clientX: event.clientX, clientY: event.clientY };
      if (!isClickWithinDragTolerance(pointerDown.current, point)) return;
      const rect = canvas.getBoundingClientRect();
      const snap =
        useModelViewerStore.getState().measureSnap ??
        nearestMeasureSnap(candidates, point, camera, rect, undefined, scratch.current);
      if (!snap) return;
      event.preventDefault();
      event.stopPropagation();
      commitMeasurePoint(snap);
      invalidate();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("click", onClick);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      latestPointer.current = null;
      pointerDown.current = null;
    };
  }, [
    camera,
    candidates,
    commitMeasurePoint,
    gl.domElement,
    invalidate,
    measureActive,
    setMeasureSnap,
  ]);

  useEffect(() => {
    if (measureActive) invalidate();
  }, [invalidate, measureActive, measureLines]);

  if (!measureActive) return null;

  return (
    <group name="measure-overlay">
      {measureLines.map((line) => (
        <MeasureLine key={line.id} line={line} unitSystem={unitSystem} />
      ))}
      {measureSnap ? (
        <mesh position={measureSnap.position} raycast={() => null}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={VIEWER_HIGHLIGHT_FALLBACK} depthTest={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function MeasureLine({
  line,
  unitSystem,
}: {
  line: ModelViewerMeasureLine;
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"];
}) {
  const midpoint = useMemo(
    () =>
      new Vector3(
        (line.start.position[0] + line.end.position[0]) / 2,
        (line.start.position[1] + line.end.position[1]) / 2,
        (line.start.position[2] + line.end.position[2]) / 2,
      ),
    [line.end.position, line.start.position],
  );

  return (
    <>
      <Line
        points={[line.start.position, line.end.position]}
        color={VIEWER_HIGHLIGHT_FALLBACK}
        lineWidth={1.6}
        transparent
        opacity={0.92}
      />
      <Html
        position={midpoint}
        center
        className="model-measure-label"
        pointerEvents="none"
        zIndexRange={SCENE_HTML_Z_INDEX_RANGE}
      >
        {formatMeasureDistance(line.distanceM, unitSystem)}
      </Html>
    </>
  );
}

function useMeasureCandidates(model: BuildingModel): MeasureSnapCandidate[] {
  return useMemo(() => {
    const seen = new Set<string>();
    const candidates: MeasureSnapCandidate[] = [];
    for (const object of model.buildingObjects) {
      object.meta.vertices.forEach((position, index) => {
        const key = position.map((value) => value.toFixed(7)).join(",");
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({
          id: `${object.id}:vertex:${index}`,
          sourceObjectId: object.id,
          position,
        });
      });
    }
    return candidates;
  }, [model.buildingObjects]);
}
