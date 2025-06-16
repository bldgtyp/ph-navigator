import * as THREE from 'three';
import { lbtLineSegment2D } from '../../../types/ladybug_geometry/geometry2d/line';

/**
 * Converts a 2D Ladybug Tools (LBT) line segment into a THREE.js `Line` object.
 *
 * This function takes a 2D line segment defined by a starting point and a direction vector
 * in the Ladybug Tools format and creates a THREE.js `Line` object. The resulting line is
 * represented as a smooth curve using a Catmull-Rom spline through the two points.
 *
 * @param lbtLineSegment2D - The Ladybug Tools 2D line segment object. It contains:
 *   - `p`: A tuple `[number, number]` representing the starting point of the line segment.
 *   - `v`: A tuple `[number, number]` representing the direction vector of the line segment.
 * @returns A THREE.js `Line` object representing the converted line segment.
 */
export function convertLBTLineSegment2DtoLine(lbtLineSegment2D: lbtLineSegment2D): THREE.Line {
    const points: THREE.Vector3[] = [];
    const v1 = new THREE.Vector3(lbtLineSegment2D.p[0], lbtLineSegment2D.p[1], 0);
    const v2 = new THREE.Vector3(
        lbtLineSegment2D.v[0] + lbtLineSegment2D.p[0],
        lbtLineSegment2D.v[1] + lbtLineSegment2D.p[1],
        0
    );
    points.push(v1);
    points.push(v2);

    // Create a smooth(ish) curve through the points
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    const line = new THREE.Line(geometry);
    return line;
}
