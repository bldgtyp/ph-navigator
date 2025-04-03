import { SceneSetup } from '../scene_setup/SceneSetup';

/**
 * Handles the resize event by updating the camera and renderer dimensions.
 * 
 * @param world - The SceneSetup object containing the camera and renderer.
 */
export function onResize(world: SceneSetup) {
    world.camera.aspect = window.innerWidth / window.innerHeight;
    world.camera.updateProjectionMatrix();
    world.renderer.setSize(window.innerWidth, window.innerHeight);
    world.labelRenderer.setSize(window.innerWidth, window.innerHeight)
}