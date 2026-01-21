import * as THREE from 'three';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { ColorByAttribute } from '../_contexts/color_by_context';
import { faceTypeColors, boundaryColors, ColorDefinition } from '../_constants/colorByColors';

/**
 * Stores the original material of a mesh in userData if not already stored.
 * This is used to restore the original material when exiting ColorBy mode.
 */
function storeOriginalMaterial(mesh: THREE.Mesh) {
    if (mesh.userData['colorByOriginalMaterial'] === undefined) {
        mesh.userData['colorByOriginalMaterial'] = mesh.material;
    }
}

/**
 * Creates a new material with the specified color for ColorBy mode.
 */
function createColorByMaterial(color: THREE.Color): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
        flatShading: true,
    });
}

/**
 * Applies color to meshes based on the specified attribute and color mapping.
 * @param group - The THREE.Group containing meshes to color.
 * @param colorMap - The color mapping to use (ColorDefinition objects).
 * @param getKey - Function to extract the attribute key from a mesh.
 */
function applyColorByAttribute(
    group: THREE.Group,
    colorMap: Record<string, ColorDefinition>,
    getKey: (mesh: THREE.Mesh) => string
) {
    group.traverse(child => {
        if (child instanceof THREE.Mesh) {
            // Store the original material for later restoration
            storeOriginalMaterial(child);

            // Get the attribute value and apply corresponding color
            const key = getKey(child);
            const colorDef = colorMap[key] || colorMap['default'];
            const newMaterial = createColorByMaterial(colorDef.color);

            // Store this color-by material in materialStore so selection highlighting works
            child.userData['materialStore'] = newMaterial;
            child.material = newMaterial;
        }
    });
}

/**
 * Applies Face Type coloring to building geometry meshes.
 */
export function applyColorByFaceType(world: SceneSetup) {
    applyColorByAttribute(world.buildingGeometryMeshes, faceTypeColors, mesh => {
        // For apertures, use 'Aperture' as the key
        if (mesh.userData['type'] === 'Aperture') {
            return 'Aperture';
        }
        // For faces, use the face_type
        return mesh.userData['face_type'] || 'default';
    });
}

/**
 * Applies Boundary Condition coloring to building geometry meshes.
 */
export function applyColorByBoundary(world: SceneSetup) {
    applyColorByAttribute(world.buildingGeometryMeshes, boundaryColors, mesh => {
        const boundaryCondition = mesh.userData['boundary_condition'];
        // The boundary condition can be an object with a 'type' property or a string
        if (typeof boundaryCondition === 'object' && boundaryCondition !== null) {
            return boundaryCondition.type || 'default';
        }
        return boundaryCondition || 'default';
    });
}

/**
 * Restores the original materials to all building geometry meshes.
 * This should be called when exiting ColorBy mode.
 */
export function restoreOriginalMaterials(world: SceneSetup) {
    world.buildingGeometryMeshes.traverse(child => {
        if (child instanceof THREE.Mesh) {
            const originalMaterial = child.userData['colorByOriginalMaterial'];
            if (originalMaterial) {
                child.material = originalMaterial;
                // Also update materialStore to point to original material
                child.userData['materialStore'] = originalMaterial;
            }
        }
    });
}

/**
 * Applies the appropriate color scheme based on the selected ColorBy attribute.
 */
export function applyColorByMode(world: SceneSetup, attribute: ColorByAttribute) {
    switch (attribute) {
        case ColorByAttribute.FaceType:
            applyColorByFaceType(world);
            break;
        case ColorByAttribute.Boundary:
            applyColorByBoundary(world);
            break;
    }
}
