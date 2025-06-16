import * as THREE from 'three';
import { lbtArc3D } from '../../../types/ladybug_geometry/geometry3d/arc';

/**
 * Converts a Ladybug Tools 3D arc (lbtArc3D) into a THREE.Line object.
 *
 * @param lbtArc3D - The Ladybug Tools 3D arc object containing the following properties:
 *   - `radius`: The radius of the arc.
 *   - `a1`: The starting angle of the arc in radians.
 *   - `a2`: The ending angle of the arc in radians.
 *   - `plane`: The plane on which the arc lies, with the following properties:
 *     - `o`: The origin of the plane as a 3-element array [x, y, z].
 *     - `n`: The normal vector of the plane as a 3-element array [x, y, z].
 *
 * @returns A THREE.Line object representing the arc in 3D space.
 *
 * @remarks
 * - The function creates an elliptical curve based on the arc's radius and angles.
 * - The curve is transformed to the specified plane's origin and oriented to face the plane's normal.
 * - The resulting THREE.Line object can be added to a THREE.js scene for visualization.
 */
export function convertLBTArc3DtoLine(lbtArc3D: lbtArc3D): THREE.Line {
    // Solution provided by GitHub CoPilot.

    // Assuming lbtArc3D is your object with radius, a1, a2, and LadybugPlane information
    const { radius, a1, a2, plane } = lbtArc3D;

    // Create an elliptical curve
    const curve = new THREE.EllipseCurve(
        0,
        0, // aX, aY
        radius,
        radius, // xRadius, yRadius
        a1,
        a2, // aStartAngle, aEndAngle
        false, // aClockwise
        0 // aRotation
    );

    // Create a curve path and add the elliptical curve to it
    const path = new THREE.CurvePath();
    path.add(curve);

    // Generate points from the curve
    const points = curve.getPoints(50);

    // Create a geometry from the points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Create the line
    const line = new THREE.Line(geometry);

    // Create a matrix for the transformation
    const matrix = new THREE.Matrix4();

    // Set the matrix to the transformation you want
    matrix.makeTranslation(plane.o[0], plane.o[1], plane.o[2]);

    // Apply the transformation to the line
    line.applyMatrix4(matrix);

    // Set the matrix to the rotation you want
    matrix.makeRotationX(Math.PI / 2); // Rotate 90 degrees around the X axis

    // Create a vector for the plane's normal
    const normal = new THREE.Vector3(plane.n[0], plane.n[1], plane.n[2]);

    // Orient the line to face the plane's normal
    line.lookAt(normal);

    return line;
}
