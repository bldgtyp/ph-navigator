import * as THREE from 'three';
import { hbAperture } from "../../types/honeybee/aperture";
import { hbFace } from "../../types/honeybee/face";
import { convertLBTFace3DToMesh } from '../ladybug_geometry/geometry3d/face';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';

/**
 * Converts a Honeybee face or aperture (`hbFace` or `hbAperture`) into a Three.js mesh
 * along with its associated wireframe, vertices, and vertex helper.
 *
 * @param face - The Honeybee face or aperture object to be converted. This object
 *               contains geometric and property data for the face or aperture.
 * 
 * @returns An object containing the following elements if the conversion is successful:
 *          - `mesh`: A Three.js `Mesh` object representing the face geometry.
 *          - `wireframe`: A Three.js `LineLoop` object representing the wireframe of the face.
 *          - `vertices`: A Three.js `Points` object representing the vertices of the face.
 *          - `vertexHelper`: A `VertexNormalsHelper` object for visualizing vertex normals.
 *          Returns `null` if the conversion fails.
 *
 * @remarks
 * The function extracts the geometry from the Honeybee face or aperture and converts it
 * into a Three.js mesh. It also attaches relevant Honeybee properties to the `userData`
 * of the mesh for further use. These properties include display name, identifier, face type,
 * boundary condition, and energy-related properties such as construction identifiers and
 * thermal performance metrics (R-factor and U-factor).
 */
export function convertHBFaceToMesh(face: hbFace | hbAperture): { mesh: THREE.Mesh, wireframe: THREE.LineLoop, vertices: THREE.Points, vertexHelper: VertexNormalsHelper } | null {
    // ------------------------------------------------------------------------
    // Build the Surface geometry elements
    const lbtFace3D = face.geometry
    const mesh = convertLBTFace3DToMesh(lbtFace3D)
    if (!mesh) { return null }

    // -- Add the HB-Face properties to the Mesh's user-data
    mesh.mesh.userData['display_name'] = face.display_name;
    mesh.mesh.userData['identifier'] = face.identifier;
    mesh.mesh.userData['face_type'] = face.face_type;
    mesh.mesh.userData['type'] = face.type;
    mesh.mesh.userData['area'] = face.geometry.area;
    mesh.mesh.userData['boundary_condition'] = face.boundary_condition;
    mesh.mesh.userData['properties'] = {
        energy: {
            construction: {
                identifier: face.properties.energy.construction.identifier,
                r_factor: face.properties.energy.construction.r_factor,
                u_factor: face.properties.energy.construction.u_factor,
            }
        }
    };

    // ------------------------------------------------------------------------
    return mesh
}