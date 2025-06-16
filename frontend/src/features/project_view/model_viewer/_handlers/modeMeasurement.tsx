import '../styles/DimensionLines.css';
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { appMaterials } from '../scene_setup/Materials';
import { selectPoint } from './selectPoint';

let selectedVertices: THREE.Vector3[] = [];
const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshBasicMaterial({
        color: 0xe600e6,
    })
);
marker.position.setScalar(1000);
const pointer = new THREE.Vector2();

function handleMeasureDistance(
    dimensionLinesRef: THREE.Group,
    hoveringVertex: React.MutableRefObject<THREE.Vector3 | null>
) {
    if (hoveringVertex.current === null) {
        return null;
    }

    if (selectedVertices.length === 0) {
        selectedVertices[0] = hoveringVertex.current;
        dimensionLinesRef.add(marker);
        marker.position.copy(hoveringVertex.current);
    } else if (selectedVertices.length === 1) {
        selectedVertices[1] = hoveringVertex.current;
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(selectedVertices),
            appMaterials.dimensionLine
        );
        line.frustumCulled = false;
        line.renderOrder = 1;
        dimensionLinesRef.add(line);

        // Build the Label
        const measurementDiv = document.createElement('div') as HTMLDivElement;
        measurementDiv.className = 'dimension-label';
        measurementDiv.innerText = '0.0';
        const measurementLabel = new CSS2DObject(measurementDiv);
        measurementLabel.position.copy(selectedVertices[0]);

        // Store the line and label
        line.geometry.attributes.position.needsUpdate = true;
        const distance = selectedVertices[0].distanceTo(selectedVertices[1]);
        measurementLabel.element.innerText = distance.toFixed(2) + 'm';
        measurementLabel.position.lerpVectors(selectedVertices[0], selectedVertices[1], 0.5);

        // Cleanup
        dimensionLinesRef.add(measurementLabel);
        selectedVertices = [];
    }
}

export function measureModeOnMouseMove(
    event: any,
    world: SceneSetup,
    hoveringVertex: React.MutableRefObject<THREE.Vector3 | null>
) {
    // Get the updated mouse position
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set the hovering-vertex indicator
    const selectedPoint = selectPoint(pointer, world);
    if (selectedPoint === null) {
        hoveringVertex.current = null;
        world.scene.remove(marker);
    } else {
        hoveringVertex.current = selectedPoint;
        world.scene.add(marker);
        marker.position.copy(selectedPoint);
    }
}

export function measureModeOnMouseClick(
    hoveringVertex: React.MutableRefObject<THREE.Vector3 | null>,
    dimensionLinesRef: React.MutableRefObject<THREE.Group>
) {
    handleMeasureDistance(dimensionLinesRef.current, hoveringVertex);
}
