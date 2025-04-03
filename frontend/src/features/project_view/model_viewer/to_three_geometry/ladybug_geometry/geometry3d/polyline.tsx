import * as THREE from 'three';
import { lbtPolyline3D } from "../../../types/ladybug_geometry/geometry3d/polyline";

/**
 * Converts a Ladybug Tools 3D polyline (`lbtPolyline3D`) into a THREE.js `Line` object.
 *
 * This function takes a polyline defined by a series of vertices in 3D space,
 * creates a smooth curve through those points using a Catmull-Rom spline,
 * and generates a THREE.js `Line` object from the resulting geometry.
 *
 * @param lbtPolyline3D - The input polyline object containing an array of vertices.
 *                         Each vertex is represented as an array of three numbers [x, y, z].
 * @returns A THREE.js `Line` object representing the smoothed polyline.
 */
export function convertLBTPolyline3DtoLine(lbtPolyline3D: lbtPolyline3D): THREE.Line {

    const points: THREE.Vector3[] = [];
    lbtPolyline3D.vertices.forEach((point: any) => {
        const vertex = new THREE.Vector3(point[0], point[1], point[2]);
        points.push(vertex);
    });

    // Create a smooth(ish) curve through the points
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    const line = new THREE.Line(geometry);
    return line
}