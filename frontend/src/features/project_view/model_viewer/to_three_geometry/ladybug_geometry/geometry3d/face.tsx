import * as THREE from 'three';
import { lbtFace3D } from "../../../types/ladybug_geometry/geometry3d/face";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';

/**
 * Converts a Ladybug Face3D object into a Three.js mesh representation, including
 * the surface mesh, wireframe boundary, vertices as points, and a vertex normals helper.
 *
 * @param lbtFace3D - The Ladybug Face3D object containing mesh and boundary data.
 * @returns An object containing the following Three.js components:
 * - `mesh`: A Three.js `Mesh` representing the surface geometry of the Face3D.
 * - `wireframe`: A Three.js `LineLoop` representing the boundary of the Face3D.
 * - `vertices`: A Three.js `Points` object representing the vertices of the Face3D for user selection.
 * - `vertexHelper`: A `VertexNormalsHelper` for visualizing vertex normals.
 * Returns `null` if the input `lbtFace3D` does not contain a mesh.
 */
export function convertLBTFace3DToMesh(lbtFace3D: lbtFace3D): { mesh: THREE.Mesh, wireframe: THREE.LineLoop, vertices: THREE.Points, vertexHelper: VertexNormalsHelper } | null {
    if (!lbtFace3D.mesh) { return null }

    // ------------------------------------------------------------------------
    // Build up the Surface Mesh from an input Ladybug-Face3D
    const vertices: THREE.Vector3[] = [];
    lbtFace3D.mesh.vertices.forEach((point: any) => {
        const vertex = new THREE.Vector3(point[0], point[1], point[2]);
        vertices.push(vertex);
    });

    // Create a new BufferGeometry to hold the mesh
    const buffGeometry = new THREE.BufferGeometry();

    // Convert LadybugMesh vertices array to a flattened Float32Array
    const vertSize = 3; // X, Y, Z
    const verticesArray = new Float32Array(vertices.length * vertSize);
    for (let i = 0; i < vertices.length; i++) {
        vertices[i].toArray(verticesArray, i * vertSize);
    }

    // Set vertices attribute  
    buffGeometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, vertSize));

    // Define faces using vertex indices
    buffGeometry.setIndex(lbtFace3D.mesh.faces.flat());

    // Be sure to set the surface normals, otherwise it won't render correctly
    buffGeometry.computeVertexNormals();

    // Create Surface Mesh
    const threeMesh = new THREE.Mesh(buffGeometry);
    threeMesh.geometry.computeBoundingBox();
    threeMesh.visible = true;
    threeMesh.castShadow = true;

    // ------------------------------------------------------------------------
    // Build up the Wireframe Boundary
    const boundaryVertices: THREE.Vector3[] = [];
    lbtFace3D.boundary.forEach((point: any) => {
        const vertex = new THREE.Vector3(point[0], point[1], point[2]);
        boundaryVertices.push(vertex);
    });

    // Close the loop by duplicating the first point
    boundaryVertices.push(boundaryVertices[0].clone());

    // Create the Outline from the boundary Points
    const wireframeGeometry = new THREE.BufferGeometry().setFromPoints(boundaryVertices);
    const threeWireframe = new THREE.LineLoop(wireframeGeometry);
    threeWireframe.geometry.computeBoundingBox();
    threeWireframe.visible = true;
    threeWireframe.renderOrder = 1;

    // ------------------------------------------------------------------------
    // Vertices as Points to allow for user-selection
    let verticesGeometry = new THREE.BufferGeometry().setFromPoints(boundaryVertices);
    verticesGeometry.deleteAttribute('normal');
    verticesGeometry.deleteAttribute('uv');
    verticesGeometry = mergeVertices(verticesGeometry);
    const positionAttribute = verticesGeometry.getAttribute('position');
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', positionAttribute);
    const cornerVertices = new THREE.Points(particleGeometry);
    cornerVertices.visible = false;
    cornerVertices.geometry.computeBoundingBox();

    // ------------------------------------------------------------------------
    const vertexHelper = new VertexNormalsHelper(threeMesh, 0.10, 0x000000)
    vertexHelper.visible = true;

    // ------------------------------------------------------------------------
    return { mesh: threeMesh, wireframe: threeWireframe, vertices: cornerVertices, vertexHelper: vertexHelper };
}