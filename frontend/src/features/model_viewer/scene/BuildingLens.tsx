import { Edges } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { MeshStandardMaterial } from "three";
import {
  materialKey,
  VIEWER_APERTURE_EDGE_COLOR,
  VIEWER_FACE_EDGE_COLOR,
  VIEWER_HIGHLIGHT_FALLBACK,
} from "../lib/colors";
import { isClickWithinDragTolerance, type PointerPoint } from "../lib/selection";
import type { BuildingModel, BuildingRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";

type BuildingLensProps = {
  model: BuildingModel;
  materials: Map<string, MeshStandardMaterial>;
};

export function BuildingLens({ model, materials }: BuildingLensProps) {
  return (
    <group name="building-lens">
      {model.objects.map((object) => (
        <BuildingObject key={object.id} object={object} materials={materials} />
      ))}
    </group>
  );
}

const BuildingObject = memo(function BuildingObject({
  object,
  materials,
}: {
  object: BuildingRenderable;
  materials: Map<string, MeshStandardMaterial>;
}) {
  const pointerDown = useRef<PointerPoint | null>(null);
  const isHovered = useModelViewerStore((state) => state.hoverId === object.id);
  const isSelected = useModelViewerStore((state) => state.selectionId === object.id);
  const setHoverId = useModelViewerStore((state) => state.setHoverId);
  const setSelectionId = useModelViewerStore((state) => state.setSelectionId);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const material = materialForObject(object, isHovered, isSelected, materials);

  const capturePointerDown = (event: ThreeEvent<PointerEvent>) => {
    pointerDown.current = {
      clientX: event.nativeEvent.clientX,
      clientY: event.nativeEvent.clientY,
    };
  };

  const selectObject = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const point = { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY };
    if (!isClickWithinDragTolerance(pointerDown.current, point)) return;
    setSelectionId(object.id);
  };

  const zoomToObject = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    setSelectionId(object.id);
    requestCamera("zoomTo", object.id);
  };

  return (
    <mesh
      geometry={object.geometry}
      material={material}
      name={object.meta.display_name}
      castShadow
      receiveShadow
      onPointerDown={capturePointerDown}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHoverId(object.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHoverId(null);
      }}
      onClick={selectObject}
      onDoubleClick={zoomToObject}
      userData={{ modelObjectId: object.id, meta: object.meta }}
    >
      <Edges
        threshold={12}
        color={
          isSelected
            ? VIEWER_HIGHLIGHT_FALLBACK
            : object.meta.type === "apertureMeshFace"
              ? VIEWER_APERTURE_EDGE_COLOR
              : VIEWER_FACE_EDGE_COLOR
        }
      />
    </mesh>
  );
});

function materialForObject(
  object: BuildingRenderable,
  isHovered: boolean,
  isSelected: boolean,
  materials: Map<string, MeshStandardMaterial>,
): MeshStandardMaterial {
  const state = isSelected ? "selected" : isHovered ? "hovered" : "base";
  const material = materials.get(materialKey(object.meta.type, state));
  if (!material) throw new Error(`Missing material for ${object.meta.type}:${state}`);
  return material;
}
