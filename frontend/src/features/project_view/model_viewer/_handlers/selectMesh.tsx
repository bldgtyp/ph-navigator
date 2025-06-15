import * as THREE from 'three';

const mouseDownPosition = new THREE.Vector2();

window.addEventListener('mousedown', (event) => {
    mouseDownPosition.x = event.clientX;
    mouseDownPosition.y = event.clientY;
});

/**
 * Retrieves the selected mesh from a mouse click event.
 * 
 * @param event - The mouse click event.
 * @param camera - The THREE.Camera object.
 * @param objects - The list of THREE.Object3D objects to check for selection with.
 * @returns The selected THREE.Mesh object, or null if no mesh is selected.
 */
export function getSelectedMeshFromMouseClick(
    event: any,
    camera: THREE.Camera,
    objects: THREE.Object3D[]
): THREE.Mesh | null {
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

    // Find the First (closest to camera) object intersecting the picking ray
    const intersects = ray_caster.intersectObjects(objects);
    const mesh = intersects.find(intersect => intersect.object instanceof THREE.Mesh) || null;
    return mesh ? mesh.object as THREE.Mesh : null;
}


/**
 * Retrieves the mesh object from the mouseover event.
 * 
 * @param event - The mouseover event.
 * @param camera - The THREE.Camera object.
 * @param objects - An array of THREE.Object3D objects.
 * @returns The THREE.Mesh object that was intersected by the picking ray, or null if no mesh was found.
 */
export function getMeshFromMouseOver(
    event: any,
    camera: THREE.Camera,
    objects: THREE.Object3D[]) {

    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // update the picking ray with the camera and pointer position
    const ray_caster = new THREE.Raycaster();
    ray_caster.setFromCamera(pointer, camera);

    // Find the First (closest to camera) object intersecting the picking ray
    const intersects = ray_caster.intersectObjects(objects);
    const mesh = intersects.find(intersect => intersect.object instanceof THREE.Mesh) || null;
    return mesh ? mesh.object as THREE.Mesh : null;
}