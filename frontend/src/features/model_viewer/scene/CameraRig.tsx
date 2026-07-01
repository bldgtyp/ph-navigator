import { GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type ElementRef } from "react";
import { Box3, Camera, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { boundsForPoints } from "../loaders/bounds";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";

type CameraRigProps = {
  model: BuildingModel;
};

export function CameraRig({ model }: CameraRigProps) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls> | null>(null);
  const cameraRequest = useModelViewerStore((state) => state.cameraRequest);
  const { camera, invalidate } = useThree();

  useEffect(() => {
    camera.up.set(0, 0, 1);
    fitCameraToBounds(camera, controlsRef.current, model.bounds, invalidate);
  }, [camera, invalidate, model.bounds]);

  useEffect(() => {
    if (!cameraRequest) return;
    if (cameraRequest.kind === "home" || cameraRequest.kind === "fit") {
      fitCameraToBounds(camera, controlsRef.current, model.bounds, invalidate);
      return;
    }
    const elementTarget = cameraRequest.targetId
      ? model.elementsById.get(cameraRequest.targetId)
      : null;
    const target =
      cameraRequest.targetId && !elementTarget ? model.metaById.get(cameraRequest.targetId) : null;
    const bounds = elementTarget
      ? boundsForPoints(
          elementTarget.segmentIds.flatMap((id) => model.metaById.get(id)?.vertices ?? []),
        )
      : target
        ? boundsForPoints(target.vertices)
        : model.bounds;
    fitCameraToBounds(camera, controlsRef.current, bounds, invalidate, 1.8);
  }, [camera, cameraRequest, invalidate, model.bounds, model.elementsById, model.metaById]);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.9}
        zoomSpeed={3}
        onChange={() => invalidate()}
      />
      <GizmoHelper alignment="bottom-right" margin={[82, 82]}>
        <GizmoViewport axisColors={["firebrick", "seagreen", "royalblue"]} labelColor="slategray" />
      </GizmoHelper>
    </>
  );
}

function fitCameraToBounds(
  camera: Camera,
  controls: Pick<ElementRef<typeof OrbitControls>, "target" | "update"> | null,
  bounds: Box3,
  invalidate: () => void,
  padding = 1.35,
): void {
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const perspective = camera instanceof PerspectiveCamera ? camera : null;
  const fov = perspective ? perspective.fov : 45;
  const distance = (maxDimension / (2 * Math.tan(MathUtils.degToRad(fov / 2)))) * padding;
  const direction = new Vector3(-0.62, 0.78, 0.46).normalize();
  camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
  if (perspective) {
    perspective.near = Math.max(distance / 1000, 0.05);
    perspective.far = Math.max(distance * 8, 1000);
  }
  camera.lookAt(center);
  perspective?.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
  invalidate();
}
