import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';

const mouseDownPosition = new THREE.Vector2();

window.addEventListener('mousedown', (event) => {
    mouseDownPosition.x = event.clientX;
    mouseDownPosition.y = event.clientY;
});

/**
 * Retrieves the selected LineSegments2 object from a mouse click event.
 * 
 * @param event - The mouse click event.
 * @param camera - The THREE.Camera object.
 * @param objects - An array of THREE.Object3D objects to check for intersection.
 * @returns The selected LineSegments2 object, or null if no object is selected.
 */
export function getSelectedLineFromMouseClick(
    event: any,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
): LineSegments2 | null {
    // Check if the mouse has moved significantly since the mousedown event
    // If it has, it's a drag operation, not a click operation
    if (Math.abs(mouseDownPosition.x - event.clientX) > 5 || Math.abs(mouseDownPosition.y - event.clientY) > 5) {
        return null;
    }

    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // update the picking ray with the camera and pointer position
    const ray_caster = new THREE.Raycaster();
    ray_caster.setFromCamera(pointer, camera);

    // Find the First (closets to camera) object intersecting the picking ray
    const intersects = ray_caster.intersectObjects(objects);
    const mesh = intersects.find(intersect => intersect.object instanceof LineSegments2) || null;
    return mesh ? mesh.object as LineSegments2 : null;
}