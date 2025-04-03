import * as THREE from 'three';
import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertLBTFace3DToMesh } from '../to_three_geometry/ladybug_geometry/geometry3d/face';
import { hbPhSpace } from "../types/honeybee_ph/space";

function groupFromSpace(space: hbPhSpace) {
    const newGroup = new THREE.Group
    newGroup.name = space.name;
    newGroup.userData["identifier"] = space.identifier;
    newGroup.userData["display_name"] = space.name;
    newGroup.userData["number"] = space.number;
    newGroup.userData["net_volume"] = space.net_volume;
    newGroup.userData["avg_clear_height"] = space.avg_clear_height;
    newGroup.userData["floor_area"] = space.floor_area;
    newGroup.userData["weighted_floor_area"] = space.weighted_floor_area;
    newGroup.userData["average_floor_weighting_factor"] = space.average_floor_weighting_factor;
    newGroup.userData["type"] = "spaceGroup";
    return newGroup
}

export function loadSpaces(world: React.RefObject<SceneSetup>, hbPHSpaces: hbPhSpace[]) {
    world.current.spaceGeometryMeshes.visible = false;
    world.current.spaceGeometryMeshes.castShadow = false;
    world.current.spaceGeometryOutlines.visible = false;
    world.current.spaceGeometryOutlines.castShadow = false;
    world.current.spaceGeometryVertices.visible = false;
    world.current.spaceGeometryVertices.castShadow = false;

    hbPHSpaces.forEach(space => {
        const spaceMeshesGroup = groupFromSpace(space)
        const spaceOutlinesGroup = groupFromSpace(space)
        const spaceVerticesGroup = groupFromSpace(space)

        space.volumes.forEach(volume => {
            volume.geometry.forEach(lbtFace3D => {
                const geom = convertLBTFace3DToMesh(lbtFace3D)
                if (!geom) { return null }

                geom.mesh.material = appMaterials.geometryStandard;
                geom.mesh.userData["type"] = "spaceMeshFace";
                geom.wireframe.material = appMaterials.wireframe;
                geom.wireframe.userData["type"] = "spaceMeshFaceWireframe";

                spaceMeshesGroup.add(geom.mesh);
                spaceOutlinesGroup.add(geom.wireframe);
                spaceVerticesGroup.add(geom.vertices);
            });
        });

        world.current.spaceGeometryMeshes.add(spaceMeshesGroup);
        world.current.spaceGeometryOutlines.add(spaceOutlinesGroup);
        world.current.spaceGeometryVertices.add(spaceVerticesGroup);
    });
}
