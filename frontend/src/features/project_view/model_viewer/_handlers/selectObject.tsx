import * as THREE from 'three';
import { SceneSetup } from '../scene_setup/SceneSetup';
import { getSelectedMeshFromMouseClick, getMeshFromMouseOver } from './selectMesh';
import { appMaterials } from '../scene_setup/Materials';
import { SelectedObjectContextType } from '../_contexts/selected_object_context';
import { HoverObjectContextType } from '../_contexts/hover_object_context';

export function clearSelection(
    SelectedObjectContext: SelectedObjectContextType,
    hoverObjectContext: HoverObjectContextType
) {
    // Remove the selection effect from the selected object
    setStandardMaterialFromStore(SelectedObjectContext.selectedObjectRef.current);
    SelectedObjectContext.selectedObjectRef.current = null;
    SelectedObjectContext.setSelectedObjectState(null);

    // Remove the hover effect from the hovered object
    setStandardMaterialFromStore(hoverObjectContext.hoverObjectRef.current);
    hoverObjectContext.hoverObjectRef.current = null;
    hoverObjectContext.setHoverObjectState(null);
}

// Material handling --------------------------------------------------------------------

/**
 * Sets the standard material from the material store on the given object and its children.
 * @param object - The object to set the material on.
 */
function setStandardMaterialFromStore(object: THREE.Object3D | THREE.Group | null) {
    if (!object) {
        return null;
    }

    if (object instanceof THREE.Mesh) {
        if (object.userData['materialStore'] === undefined) {
            return null;
        }
        object.material = object.userData['materialStore'];
    } else if (object instanceof THREE.Group) {
        object.children.forEach((child: any) => {
            setStandardMaterialFromStore(child);
        });
    }
}

/**
 * Stores the standard material of a THREE.Mesh object or its children in the userData.
 * This is used to restore the original material after a temporary material change.
 * @param object - The THREE.Object3D, THREE.Group, or null object to store the material for.
 */
function storeStandardMaterial(object: THREE.Object3D | THREE.Group | null) {
    if (object instanceof THREE.Mesh) {
        if (object.userData['materialStore'] !== undefined) {
            return null;
        }
        object.userData['materialStore'] = object.material;
    } else if (object instanceof THREE.Group) {
        object.children.forEach((child: any) => {
            storeStandardMaterial(child);
        });
    }
}

/**
 * Sets a new material for the given object and all of its children.
 * If the object is a mesh, the material is applied directly to it.
 * If the object is a group, the material is applied to all its children recursively.
 * @param object - The object to apply the new material to.
 * @param material - The new material to set.
 */
function setNewMaterial(object: THREE.Object3D | THREE.Group | null, material: THREE.Material) {
    if (object instanceof THREE.Mesh) {
        object.material = material;
    } else if (object instanceof THREE.Group) {
        object.children.forEach((child: any) => {
            setNewMaterial(child, material);
        });
    }
}

// Click --------------------------------------------------------------------------------

/**
 * Sets the 'selected' state to 'true' for the given object and all its children.
 * @param object - The object to set the 'selected' state for.
 */
function setSelectedObject(object: THREE.Object3D | THREE.Group | null) {
    if (object instanceof THREE.Mesh) {
        object.userData['selected'] = true;
    } else if (object instanceof THREE.Group) {
        object.userData['selected'] = true;
        object.children.forEach((child: any) => {
            setSelectedObject(child);
        });
    }
}

/**
 * Sets the 'selected' state to 'false' for the given object and all its children.
 * @param object - The object to set the 'selected' state for.
 */
function unSetSelectedObject(object: THREE.Object3D | THREE.Group | null) {
    if (object instanceof THREE.Mesh) {
        object.userData['selected'] = false;
    } else if (object instanceof THREE.Group) {
        object.userData['selected'] = false;
        object.children.forEach((child: any) => {
            unSetSelectedObject(child);
        });
    }
}

/**
 * Handles the onClick event for changing the material of a selected object.
 *
 * @param selectedObject - The selected object to change the material for.
 * @param selectedObjectContext - The context object containing the selected object reference and state.
 */
function handleOnClickMaterialChange(
    selectedObject: THREE.Mesh | THREE.Group | null,
    selectedObjectContext: SelectedObjectContextType
) {
    // Re-set any existing object's materials
    setStandardMaterialFromStore(selectedObjectContext.selectedObjectRef.current);

    // Set the new object Material
    storeStandardMaterial(selectedObject);
    setNewMaterial(selectedObject, appMaterials.geometrySelected);

    // Track the new selected object
    selectedObjectContext.selectedObjectRef.current = selectedObject;
    selectedObjectContext.setSelectedObjectState(selectedObject);
}

/**
 * Handles the click event on a mesh face or group.
 *
 * @param e - The click event object.
 * @param world - The scene setup object.
 * @param selectedObjectContext - The selected object context.
 */
export function handleOnClick(e: any, world: SceneSetup, selectedObjectContext: SelectedObjectContextType) {
    e.preventDefault();
    const newMesh = getSelectedMeshFromMouseClick(e, world.camera, world.selectableObjects.children);
    if (newMesh) {
        // The user has clicked on a selectable object, so change the material
        world.renderer.domElement.style.cursor = 'pointer';
        unSetSelectedObject(selectedObjectContext.selectedObjectRef.current);

        if (newMesh.parent?.userData['type'] == 'spaceGroup' && newMesh.parent instanceof THREE.Group) {
            // If the selected object is a space group, select the parent group
            setSelectedObject(newMesh.parent);
            handleOnClickMaterialChange(newMesh.parent, selectedObjectContext);
        } else {
            // If the selected object is a simple mesh surface, select the surface
            setSelectedObject(newMesh);
            handleOnClickMaterialChange(newMesh, selectedObjectContext);
        }
    } else {
        // The user has clicked on blank space, so remove any selection effect.
        world.renderer.domElement.style.cursor = 'auto';
    }
}

// Hover --------------------------------------------------------------------------------

/**
 * Handles the material change when hovering over an object.
 *
 * @param hoverObject - The object being hovered over.
 * @param objectContext - The context object containing hover object references and state.
 */
function handleOnHoverMaterialChange(
    hoverObject: THREE.Mesh | THREE.Group | null,
    objectContext: HoverObjectContextType
) {
    // Do not change any material of the existing active selection
    if (objectContext.hoverObjectRef.current?.userData['selected'] !== true) {
        setStandardMaterialFromStore(objectContext.hoverObjectRef.current);
    }

    // Change the material of the new hover object
    if (hoverObject?.userData['selected'] !== true) {
        storeStandardMaterial(hoverObject);
        setNewMaterial(hoverObject, appMaterials.geometryHoverOver);
    }

    // Track the new hover object
    objectContext.hoverObjectRef.current = hoverObject;
    objectContext.setHoverObjectState(hoverObject);
}

/**
 * Handles the mouse over event on a selectable object.
 * Changes the material of the object being hovered over and updates the cursor style.
 *
 * @param e - The pointer event object.
 * @param world - The scene setup object.
 * @param hoverObjectContext - The hover object context.
 */
export function handleOnMouseOver(e: PointerEvent, world: SceneSetup, hoverObjectContext: HoverObjectContextType) {
    e.preventDefault();
    const newMesh = getMeshFromMouseOver(e, world.camera, world.selectableObjects.children);
    if (newMesh) {
        // The user is hovering over a selectable object, so change the material
        world.renderer.domElement.style.cursor = 'pointer';
        if (newMesh.parent?.userData['type'] == 'spaceGroup' && newMesh.parent instanceof THREE.Group) {
            handleOnHoverMaterialChange(newMesh.parent, hoverObjectContext);
        } else {
            handleOnHoverMaterialChange(newMesh, hoverObjectContext);
        }
    } else {
        // The user is hovering over blank space, so remove any hovering effect.
        world.renderer.domElement.style.cursor = 'auto';
        if (hoverObjectContext.hoverObjectRef.current?.userData['selected'] !== true) {
            setStandardMaterialFromStore(hoverObjectContext.hoverObjectRef.current);
        }
    }
}
