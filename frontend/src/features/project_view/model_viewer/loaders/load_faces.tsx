import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { appMaterials } from '../scene_setup/Materials';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { convertHBFaceToMesh } from '../to_three_geometry/honeybee/face';
import { hbFace } from "../types/honeybee/face";


function getMeshCenter(mesh: THREE.Mesh) {
    // Ensure the geometry's bounding box is up-to-date
    mesh.geometry.computeBoundingBox();

    // Get the bounding box
    const boundingBox = mesh.geometry.boundingBox;

    // Compute the center of the bounding box
    const center = new THREE.Vector3();
    boundingBox?.getCenter(center);

    // Return the center
    return center;
}


function calcNormal(msh: THREE.Mesh) {
    // Assuming geometry is BufferGeometry and has position attribute
    const positions = msh.geometry.attributes.position.array;

    // Get the positions of the first face's vertices
    const p1 = new THREE.Vector3(positions[0], positions[1], positions[2]);
    const p2 = new THREE.Vector3(positions[3], positions[4], positions[5]);
    const p3 = new THREE.Vector3(positions[6], positions[7], positions[8]);

    // Compute the vectors of the two sides of the face
    const v1 = new THREE.Vector3().subVectors(p2, p1);
    const v2 = new THREE.Vector3().subVectors(p3, p1);

    // Compute the face normal
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
    return normal
}


// Function to create a text label
function createTextLabel(text: string, msh: THREE.Mesh): any {
    msh.geometry.computeVertexNormals()
    // console.log(msh)
    const meshCenterPoint = getMeshCenter(msh)
    const textMesh = new Text();
    textMesh.text = text;
    textMesh.fontSize = 0.1;
    textMesh.position.set(meshCenterPoint.x, meshCenterPoint.y, meshCenterPoint.z);

    // Set the rotation of the textMesh to match the normal
    const vertexNormals = msh.geometry.attributes.normal.array
    const faceNormal = new THREE.Vector3(vertexNormals[0], vertexNormals[1], vertexNormals[2]);
    // TODO: This part is not working properly
    // textMesh.lookAt(faceNormal);

    textMesh.anchorX = 'center';
    textMesh.anchorY = 'middle';
    textMesh.color = 0x000000;
    return null
    // return textMesh
}


export function loadModelFaces(world: React.RefObject<SceneSetup>, hbFaces: hbFace[]) {
    hbFaces.forEach(face => {
        const geom = convertHBFaceToMesh(face)
        if (!geom) { return }

        geom.mesh.name = face.display_name
        geom.mesh.userData["type"] = "faceMesh"
        geom.mesh.material = appMaterials.geometryStandard
        geom.mesh.visible = true
        world.current.buildingGeometryMeshes.add(geom.mesh)

        geom.vertexHelper.name = face.display_name
        geom.vertexHelper.userData["type"] = "faceMeshVertexHelper"
        geom.vertexHelper.visible = true
        world.current.buildingGeometryMeshes.add(geom.vertexHelper)

        geom.wireframe.name = face.display_name
        geom.wireframe.userData["type"] = "faceMeshWireframe"
        geom.wireframe.material = appMaterials.wireframe
        geom.wireframe.visible = true
        world.current.buildingGeometryOutlines.add(geom.wireframe)

        geom.vertices.visible = false
        world.current.buildingGeometryVertices.add(geom.vertices)

        face.apertures.forEach(aperture => {
            const apertureGeom = convertHBFaceToMesh(aperture)
            if (apertureGeom !== null) {
                apertureGeom.mesh.name = face.display_name
                apertureGeom.mesh.userData["type"] = "apertureMeshFace"
                apertureGeom.mesh.material = appMaterials.geometryWindow
                apertureGeom.mesh.visible = true
                world.current.buildingGeometryMeshes.add(apertureGeom.mesh)

                apertureGeom.vertexHelper.name = face.display_name
                apertureGeom.vertexHelper.userData["type"] = "apertureMeshFaceVertexHelper"
                apertureGeom.vertexHelper.visible = true
                world.current.buildingGeometryMeshes.add(apertureGeom.vertexHelper)

                apertureGeom.wireframe.name = face.display_name
                apertureGeom.wireframe.userData["type"] = "apertureMeshFaceWireframe"
                apertureGeom.wireframe.material = appMaterials.wireframe
                apertureGeom.wireframe.visible = true
                world.current.buildingGeometryOutlines.add(apertureGeom.wireframe)

                apertureGeom.vertices.visible = false
                world.current.buildingGeometryVertices.add(apertureGeom.vertices)

                const txt = createTextLabel(aperture.display_name, apertureGeom.mesh)
                world.current.buildingGeometryMeshes.add(txt)
            }
        });
    });
}
