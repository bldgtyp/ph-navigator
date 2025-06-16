import { SceneSetup } from '../scene_setup/SceneSetup';
import * as THREE from 'three';

function findNearestFaceVertex(faceIndex: any, intersect: any) {
    // https://jsfiddle.net/prisoner849/jx9rfq5n/
    let idx = 0;
    const bc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const tri = new THREE.Triangle();
    const tp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const intersectPoint = new THREE.Vector3();
    intersectPoint.copy(intersect.point);
    intersect.object.worldToLocal(intersectPoint);

    // Build a Triangle for the face
    tp[0].fromBufferAttribute(intersect.object.geometry.attributes.position, faceIndex * 3 + 0);
    tp[1].fromBufferAttribute(intersect.object.geometry.attributes.position, faceIndex * 3 + 1);
    tp[2].fromBufferAttribute(intersect.object.geometry.attributes.position, faceIndex * 3 + 2);
    tri.set(tp[0], tp[1], tp[2]);

    // Find the closest vertex point
    tri.getBarycoord(intersectPoint, bc);
    if (bc.x > bc.y && bc.x > bc.z) {
        idx = 0;
    } else if (bc.y > bc.x && bc.y > bc.z) {
        idx = 1;
    } else if (bc.z > bc.x && bc.z > bc.y) {
        idx = 2;
    }
    const faceVertex = pos.copy(tp[idx]);
    return intersect.object.localToWorld(faceVertex);
}

function getIntersectionObjectFromMouseClick(
    event: any,
    ray_caster: THREE.Raycaster,
    world: SceneSetup
): THREE.Intersection<THREE.Object3D<THREE.Object3DEventMap>> | null {
    // calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // update the ray-cast with the camera and pointer position
    ray_caster.setFromCamera(pointer, world.camera);

    // Find the first (closest to camera) object intersecting the ray-cast
    const intersects = ray_caster.intersectObjects(world.buildingGeometryMeshes.children);
    const intersect = intersects.find(intersect => intersect.object instanceof THREE.Mesh) || null;
    return intersect ? intersect : null;
}

export function getNearestFaceVertex(event: any, ray_caster: THREE.Raycaster, world: SceneSetup): THREE.Vector3 | null {
    const intersect = getIntersectionObjectFromMouseClick(event, ray_caster, world);
    if (intersect && intersect.object instanceof THREE.Mesh) {
        const faceVertex = findNearestFaceVertex(intersect.faceIndex, intersect);
        return faceVertex;
    }
    return null;
}
