import * as THREE from 'three';
import { lbtLineSegment3D } from "../../../types/ladybug_geometry/geometry3d/line";
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/**
 * Converts a Ladybug Tools 3D line segment (`lbtLineSegment3D`) into a Three.js `LineSegmentsGeometry`.
 * 
 * @param lbtLineSegment2D - The input 3D line segment object from Ladybug Tools, containing:
 *   - `p`: A 3D point array [x, y, z] representing the starting point of the line segment.
 *   - `v`: A 3D vector array [x, y, z] representing the direction and magnitude of the line segment.
 * @param smooth - A boolean flag indicating whether to create a smooth curve (default: `false`).
 *   - If `true`, a smooth curve is created using `CatmullRomCurve3` with 50 points.
 *   - If `false`, a straight line is created using `CatmullRomCurve3` with 2 points.
 * @returns A `LineSegmentsGeometry` object representing the converted line segment.
 */
export function convertLBTLineSegment3DtoLine(
    lbtLineSegment2D: lbtLineSegment3D,
    smooth: boolean = false,
): LineSegmentsGeometry {
    const points: THREE.Vector3[] = [];
    const v1 = new THREE.Vector3(lbtLineSegment2D.p[0], lbtLineSegment2D.p[1], lbtLineSegment2D.p[2],)
    const v2 = new THREE.Vector3(
        lbtLineSegment2D.v[0] + lbtLineSegment2D.p[0],
        lbtLineSegment2D.v[1] + lbtLineSegment2D.p[1],
        lbtLineSegment2D.v[2] + lbtLineSegment2D.p[2]
    )
    points.push(v1);
    points.push(v2);

    if (smooth == true) {
        // Create a smooth(ish) curve through the points
        const curve = new THREE.CatmullRomCurve3(points);
        const bufferGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
        const edgeGeometry = new THREE.EdgesGeometry(bufferGeometry);
        return new LineSegmentsGeometry().fromEdgesGeometry(edgeGeometry);
        // const line = new THREE.Line(bufferGeometry);
        // return line
    } else {
        // Create a straight line through the points
        const curve = new THREE.CatmullRomCurve3(points);
        const bufferGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(2));
        const edgeGeometry = new THREE.EdgesGeometry(bufferGeometry);
        return new LineSegmentsGeometry().fromEdgesGeometry(edgeGeometry);
        // const line = new THREE.Line(bufferGeometry);
        // return line;
    }
}