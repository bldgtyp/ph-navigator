// Startup the THREE World, run the animation loop, and handle window resize events

import { useEffect, useRef } from 'react';
import { SceneSetup } from './scene_setup/SceneSetup';
import { onResize } from './handlers/onResize';

interface ViewContainerProps {
    world: React.RefObject<SceneSetup>;
}

function World(props: ViewContainerProps) {
    console.log("Rendering World Component...")

    const { world } = props;
    const mountRef = useRef<HTMLDivElement | null>(null);

    // Setup the THREE Scene, Run the Animation
    // ------------------------------------------------------------------------
    useEffect(() => {
        // Add the THREE Renderer to the DOM
        if (mountRef.current) {
            mountRef.current.appendChild(world.current.renderer.domElement);
        }

        // Handle Window Resize
        window.addEventListener('resize', () => onResize(world.current));

        // THREE Animation Loop 
        const animate = function () {
            requestAnimationFrame(animate);
            world.current.controls.update();
            world.current.composer.render();
            world.current.labelRenderer.render(world.current.scene, world.current.camera)
        };

        animate();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={mountRef} />

}

export default World;