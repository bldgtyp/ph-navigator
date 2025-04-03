import * as THREE from 'three';
import { lbtArc2D } from "../../../types/ladybug_geometry/geometry2d/arc";

/**
 * Converts a 2D Ladybug Tools arc (`lbtArc2D`) into a THREE.js `Line` object.
 *
 * @param lbtArc2D - An object representing a 2D arc in Ladybug Tools format. 
 *                   It contains the following properties:
 *                   - `r`: The radius of the arc.
 *                   - `c`: The center of the arc as a 2D coordinate [x, y].
 *                   - `a1`: The starting angle of the arc in radians.
 *                   - `a2`: The ending angle of the arc in radians.
 * @param num_interpolation_points - The number of points to sample along the arc. Default is 50.
 * 
 * @returns A THREE.js `Line` object representing the arc.
 *
 * @remarks
 * - The function uses `THREE.EllipseCurve` to create the arc as a curve.
 * - The arc is transformed to the correct position using a translation matrix.
 */
export function convertLBTArc2DtoLine(lbtArc2D: lbtArc2D, num_interpolation_points: number = 50): THREE.Line {
    // Solution provided by GitHub CoPilot.

    // Assuming lbtArc3D is your object with radius, a1, a2, and LadybugPlane information
    const { r, c, a1, a2 } = lbtArc2D;

    // Create an elliptical curve
    const curve = new THREE.EllipseCurve(
        0, 0, // aX, aY
        r, r, // xRadius, yRadius
        a1, a2, // aStartAngle, aEndAngle
        false, // aClockwise
        0 // aRotation
    );

    // Create a curve path and add the elliptical curve to it
    const path = new THREE.CurvePath();
    path.add(curve);

    // Generate points from the curve
    const points = curve.getPoints(num_interpolation_points);

    // Create a geometry from the points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Create the line
    const line = new THREE.Line(geometry);

    // Create a matrix for the transformation
    const matrix = new THREE.Matrix4();

    // Set the matrix to the transformation you want
    matrix.makeTranslation(c[0], c[1], 0);

    // Apply the transformation to the line
    line.applyMatrix4(matrix);

    return line
}