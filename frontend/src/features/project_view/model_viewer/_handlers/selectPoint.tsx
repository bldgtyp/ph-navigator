import * as THREE from 'three';
const raycaster = new THREE.Raycaster();

/**
 * Performs a ray-cast intersection to select a point in 3D space.
 * 
 * @param pointer - The pointer coordinates in normalized device space.
 * @param world - The world object containing the camera and building geometry.
 * @param tolerance - The maximum distance from the ray to consider a point as selected. Default is 0.5.
 * @returns The selected point as a THREE.Vector3 object, or null if no point is selected.
 */
export function selectPoint(pointer: any, world: any, tolerance: number = 0.5): THREE.Vector3 | null {
    /// ----------------------------------------------------------------------------------------------------------------
    // --- Perform the ray-cast intersection
    raycaster.setFromCamera(pointer, world.camera);
    const intersects = raycaster.intersectObject(world.buildingGeometryVertices, true);
    const intersect = intersects.find(intersect => intersect.object instanceof THREE.Points) || null;
    if (!intersect || intersect.distanceToRay === undefined || intersect.distanceToRay > tolerance) {
        return null;
    }

    const { object, index } = intersect;

    if (!(object instanceof THREE.Points) || index === undefined) {
        return null;
    }
    /// ----------------------------------------------------------------------------------------------------------------
    // -- Get the vertex position and build a new Vector3
    const geom: THREE.BufferGeometry = object.geometry;
    const values: THREE.TypedArray = geom.attributes.position.array;
    const startingIndex = index * geom.attributes.position.itemSize;
    const updatedVertex = new THREE.Vector3(values[startingIndex], values[startingIndex + 1], values[startingIndex + 2]);
    return updatedVertex
}