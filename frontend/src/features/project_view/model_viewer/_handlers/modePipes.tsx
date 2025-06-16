import * as THREE from 'three';
import '../styles/DimensionLines.css';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { appMaterials } from '../scene_setup/Materials';
import { SelectedObjectContextType } from '../_contexts/selected_object_context';
import { getSelectedLineFromMouseClick } from './selectLineSegment2';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2';

/**
 * Resets the material of a line object to its original standard material.
 * @param line - The line object to reset the material for.
 */
function resetLineMaterial(line: THREE.Object3D | null) {
    if (line instanceof LineSegments2) {
        const mat = line.userData['standardMaterial'];
        if (mat !== undefined) {
            line.material = mat;
        }
    }
}

/**
 * Handles the mouse click event for piping mode.
 *
 * @param event - The mouse click event.
 * @param world - The scene setup.
 * @param selectedObjectContext - The selected object context.
 */
export function pipingModeOnMouseClick(
    event: any,
    world: SceneSetup,
    selectedObjectContext: SelectedObjectContextType
) {
    event.preventDefault();
    const newLine = getSelectedLineFromMouseClick(event, world.camera, world.pipeGeometry.children);
    if (newLine) {
        if (newLine instanceof LineSegments2) {
            resetLineMaterial(selectedObjectContext.selectedObjectRef.current);
            newLine.userData['standardMaterial'] = newLine.material; // Store for changing back later
            newLine.material = appMaterials.pipeLineHighlight;
        }

        selectedObjectContext.selectedObjectRef.current = newLine;
        selectedObjectContext.setSelectedObjectState(newLine);
    }
}

/**
 * Clears the selected line and resets its material.
 *
 * @param selectedObjectContext - The context object containing the selected object reference and state.
 */
export function handleClearSelectedLine(selectedObjectContext: SelectedObjectContextType) {
    resetLineMaterial(selectedObjectContext.selectedObjectRef.current);
    selectedObjectContext.selectedObjectRef.current = null;
    selectedObjectContext.setSelectedObjectState(null);
}
