import * as THREE from 'three';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { ColorByAttribute } from '../_contexts/color_by_context';
import {
    faceTypeColors,
    boundaryColors,
    ventilationAirflowColors,
    floorWeightingFactorColors,
    ColorDefinition,
    createConstructionColorDef,
} from '../_constants/colorByColors';

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
 * Uses MeshBasicMaterial to ignore scene lighting, ensuring colors
 * appear flat and match legend swatches exactly.
 */
function createColorByMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
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
 * Restores the original materials to all space geometry meshes.
 * This should be called when exiting ColorBy mode or switching sub-modes.
 */
export function restoreSpaceOriginalMaterials(world: SceneSetup) {
    world.spaceGeometryMeshes.traverse(child => {
        if (child instanceof THREE.Mesh) {
            const originalMaterial = child.userData['colorByOriginalMaterial'];
            if (originalMaterial) {
                child.material = originalMaterial;
                child.userData['materialStore'] = originalMaterial;
            }
        }
    });
}

/**
 * Restores the original materials to all floor geometry meshes.
 * This should be called when exiting ColorBy mode or switching sub-modes.
 */
export function restoreFloorOriginalMaterials(world: SceneSetup) {
    world.spaceFloorGeometryMeshes.traverse(child => {
        if (child instanceof THREE.Mesh) {
            const originalMaterial = child.userData['colorByOriginalMaterial'];
            if (originalMaterial) {
                child.material = originalMaterial;
                child.userData['materialStore'] = originalMaterial;
            }
        }
    });
}

/**
 * Determines the weighting factor category from a numeric value.
 */
function getWeightingFactorCategory(wf: number | null | undefined): string {
    if (wf === null || wf === undefined) return 'default';
    if (wf === 1.0 || wf > 0.6) return 'FullyTreated';
    if (wf > 0.5 && wf <= 0.6) return 'SemiConditioned';
    if (wf > 0.3 && wf <= 0.5) return 'PartiallyTreated';
    if (wf > 0.0 && wf <= 0.3) return 'MinimallyTreated';
    if (wf === 0.0) return 'NonTreated';
    return 'default';
}

/**
 * Applies Floor Weighting Factor coloring to floor segment meshes.
 * Colors each floor segment based on its weighting factor value.
 */
export function applyColorByFloorWeightingFactor(world: SceneSetup): void {
    world.spaceFloorGeometryMeshes.traverse(child => {
        if (child instanceof THREE.Mesh && child.userData['type'] === 'spaceFloorSegmentMeshFace') {
            storeOriginalMaterial(child);
            const wf = child.userData['weighting_factor'];
            const category = getWeightingFactorCategory(wf);
            const colorDef = floorWeightingFactorColors[category] || floorWeightingFactorColors['default'];
            const newMaterial = createColorByMaterial(colorDef.color);
            child.userData['materialStore'] = newMaterial;
            child.material = newMaterial;
        }
    });
}

/**
 * Determines the ventilation category based on supply and extract air values.
 */
function getVentilationCategory(vSup: number | null, vEta: number | null): string {
    const hasSupply = vSup !== null && vSup > 0;
    const hasExtract = vEta !== null && vEta > 0;

    if (hasSupply && hasExtract) return 'SupplyAndExtract';
    if (hasSupply && !hasExtract) return 'SupplyOnly';
    if (!hasSupply && hasExtract) return 'ExtractOnly';
    return 'NoVentilation';
}

/**
 * Applies Ventilation Airflow coloring to space geometry meshes.
 * Colors each space's faces based on the space's ventilation characteristics.
 */
export function applyColorByVentilationAirflow(world: SceneSetup): void {
    world.spaceGeometryMeshes.traverse(child => {
        // Process space Groups (each space is a Group containing face meshes)
        if (child instanceof THREE.Group && child.userData['type'] === 'spaceGroup') {
            // Get ventilation data from the space Group's userData
            const vSup = child.userData['properties']?.ph?._v_sup ?? null;
            const vEta = child.userData['properties']?.ph?._v_eta ?? null;
            const category = getVentilationCategory(vSup, vEta);
            const colorDef = ventilationAirflowColors[category] || ventilationAirflowColors['default'];

            // Apply color to all face meshes within this space
            child.traverse(grandchild => {
                if (grandchild instanceof THREE.Mesh) {
                    storeOriginalMaterial(grandchild);
                    const newMaterial = createColorByMaterial(colorDef.color);
                    grandchild.userData['materialStore'] = newMaterial;
                    grandchild.material = newMaterial;
                }
            });
        }
    });
}

/**
 * Applies Construction Name coloring to meshes of a specific type.
 * @param world - The SceneSetup containing building geometry.
 * @param targetMeshType - The mesh type to color ('faceMesh' or 'apertureMeshFace').
 * @returns Map of construction names to their color definitions for legend generation.
 */
function applyColorByConstruction(world: SceneSetup, targetMeshType: string): Map<string, ColorDefinition> {
    const constructionColors = new Map<string, ColorDefinition>();

    world.buildingGeometryMeshes.traverse(child => {
        if (child instanceof THREE.Mesh) {
            const meshType = child.userData['type'];
            storeOriginalMaterial(child);

            if (meshType === targetMeshType) {
                const constructionId = child.userData['properties']?.energy?.construction?.identifier || 'Unknown';

                if (!constructionColors.has(constructionId)) {
                    constructionColors.set(constructionId, createConstructionColorDef(constructionId));
                }

                const colorDef = constructionColors.get(constructionId)!;
                const newMaterial = createColorByMaterial(colorDef.color);
                child.userData['materialStore'] = newMaterial;
                child.material = newMaterial;
            }
        }
    });

    return constructionColors;
}

/** Applies Construction Name coloring to opaque surfaces (Wall, RoofCeiling, Floor). */
export function applyColorByOpaqueConstruction(world: SceneSetup): Map<string, ColorDefinition> {
    return applyColorByConstruction(world, 'faceMesh');
}

/** Applies Construction Name coloring to apertures (windows, doors). */
export function applyColorByApertureConstruction(world: SceneSetup): Map<string, ColorDefinition> {
    return applyColorByConstruction(world, 'apertureMeshFace');
}

/**
 * Applies the appropriate color scheme based on the selected ColorBy attribute.
 * Returns a Map of construction colors for dynamic legend generation (for construction modes),
 * or null for static legend modes (FaceType, Boundary, VentilationAirflow, FloorWeightingFactor).
 */
export function applyColorByMode(world: SceneSetup, attribute: ColorByAttribute): Map<string, ColorDefinition> | null {
    // Restore original materials before applying new color scheme
    // This ensures clean state when switching between color modes
    restoreOriginalMaterials(world);
    restoreSpaceOriginalMaterials(world);
    restoreFloorOriginalMaterials(world);

    switch (attribute) {
        case ColorByAttribute.FaceType:
            applyColorByFaceType(world);
            return null;
        case ColorByAttribute.Boundary:
            applyColorByBoundary(world);
            return null;
        case ColorByAttribute.OpaqueConstruction:
            return applyColorByOpaqueConstruction(world);
        case ColorByAttribute.ApertureConstruction:
            return applyColorByApertureConstruction(world);
        case ColorByAttribute.VentilationAirflow:
            applyColorByVentilationAirflow(world);
            return null;
        case ColorByAttribute.FloorWeightingFactor:
            applyColorByFloorWeightingFactor(world);
            return null;
    }
}
