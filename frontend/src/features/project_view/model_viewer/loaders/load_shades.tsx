import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertLBTFace3DToMesh } from '../to_three_geometry/ladybug_geometry/geometry3d/face';
import { hbShadeGroup } from '../types/honeybee/shade';

export function loadShades(
    world: React.RefObject<SceneSetup>,
    data: hbShadeGroup[]
) {
    world.current.shadingGeometryMeshes.visible = false;
    world.current.shadingGeometryMeshes.castShadow = false;
    world.current.shadingGeometryWireframe.visible = false
    world.current.shadingGeometryWireframe.castShadow = false

    data.forEach((shadeGroup) => {
        // -- Build up the mesh geometry for each shade-group's faces
        const shadeMeshGroup = new THREE.Group;
        shadeGroup.shades.forEach((shade) => {
            const geom = convertLBTFace3DToMesh(shade.geometry)
            geom ? shadeMeshGroup.add(geom.mesh) : null;
        })

        // -- Merge the shade group's elements into a single mesh
        const mergedBufferGeometry = BufferGeometryUtils.mergeGeometries(
            shadeMeshGroup.children.map((child) => { return (child as THREE.Mesh).geometry; }
            ));
        const mergedMesh = new THREE.Mesh(mergedBufferGeometry);
        mergedMesh.material = appMaterials.geometryShading;
        world.current.shadingGeometryMeshes.add(mergedMesh);

        // -- Add the mesh edge-lines
        // -- Note that 'EdgeGeometry' has a thresholdAngle parameter that can be used to
        // -- control the angle between faces that will be considered as an edge.
        const edges = new THREE.EdgesGeometry(mergedBufferGeometry);
        const line = new THREE.LineSegments(edges, appMaterials.wireframeDarkGrey);
        world.current.shadingGeometryWireframe.add(line);
    });
}