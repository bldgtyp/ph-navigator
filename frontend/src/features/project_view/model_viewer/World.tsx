// Startup the THREE World, run the animation loop, and handle window resize events
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

import { SceneSetup } from './scene_setup/SceneSetup';
import { onResize } from './handlers/onResize';
import { useAppVizStateContext } from './contexts/app_viz_state_context';
import { useAppToolStateContext } from './contexts/app_tool_state_context';
import { useSelectedObjectContext } from './contexts/selected_object_context';
import { useHoverObjectContext } from './contexts/hover_object_context';
import { handleOnClick, handleOnMouseOver, clearSelection } from './handlers/selectObject';
import { measureModeOnMouseClick, measureModeOnMouseMove } from './handlers/modeMeasurement';
import { addVizStateMountHandler, addVizStateDismountHandler } from './states/VizState';
import { addToolStateEventHandler, addToolStateDismountHandler } from './states/ToolState';

interface ViewContainerProps {
    world: React.RefObject<SceneSetup>;
    hoveringVertex: React.RefObject<THREE.Vector3 | null>;
    dimensionLinesRef: React.RefObject<THREE.Group>;
}

const World: React.FC<ViewContainerProps> = ({ world, hoveringVertex, dimensionLinesRef }) => {
    const appVizStateContext = useAppVizStateContext();
    const appToolStateContext = useAppToolStateContext();
    const selectedObjectContext = useSelectedObjectContext();
    const hoverObjectContext = useHoverObjectContext();
    const mountRef = useRef<HTMLDivElement | null>(null);

    // Setup all the Event Listener Callbacks for the different Tool-States
    // For some reason, this does not work unless these are all wrapped in useCallback?
    // ------------------------------------------------------------------------
    addToolStateEventHandler(1, "click",
        useCallback(
            (e: any) => { handleOnClick(e, world.current, selectedObjectContext) }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            , [])
    );
    addToolStateEventHandler(1, "pointermove",
        useCallback(
            (e: any) => { handleOnMouseOver(e, world.current, hoverObjectContext) }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            , [])
    );
    addToolStateEventHandler(2, "click",
        useCallback(
            () => { measureModeOnMouseClick(hoveringVertex, dimensionLinesRef) }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            , [])
    );
    addToolStateEventHandler(2, "pointermove",
        useCallback(
            (e: any) => { measureModeOnMouseMove(e, world.current, hoveringVertex) }
            // eslint-disable-next-line react-hooks/exhaustive-deps
            , [])
    );


    // Dismount Handlers for ToolStates
    // ------------------------------------------------------------------------
    addToolStateDismountHandler(1, "clearSelectedMesh", () => {
        // handleClearSelectedLine(selectedObjectContext)
        // handleClearSelectedSpace(selectedObjectContext)
        // handleClearSelectedMeshFace(selectedObjectContext)
    });
    addToolStateDismountHandler(2, "clearDims", () => {
        hoveringVertex.current = null;
        dimensionLinesRef.current.clear()
    });



    // Mount Handlers for Viz-States
    // ------------------------------------------------------------------------
    addVizStateMountHandler(0, "showDefault", () => {
        world.current.buildingGeometryMeshes.visible = true;
        world.current.selectableObjects.add(world.current.buildingGeometryMeshes)
        world.current.selectableObjects.visible = true;
        world.current.buildingGeometryOutlines.visible = true;
        world.current.buildingGeometryVertices.visible = true;
    });
    addVizStateMountHandler(1, "showGeometry", () => {
        world.current.buildingGeometryMeshes.visible = true;
        world.current.selectableObjects.add(world.current.buildingGeometryMeshes)
        world.current.selectableObjects.visible = true;
        world.current.buildingGeometryOutlines.visible = true;
        world.current.buildingGeometryVertices.visible = true;
    });
    addVizStateMountHandler(2, "showSpaceFloors", () => {
        world.current.spaceFloorGeometryMeshes.visible = true;
        world.current.selectableObjects.add(world.current.spaceFloorGeometryMeshes)
        world.current.selectableObjects.visible = true;
        world.current.spaceFloorGeometryOutlines.visible = true
        world.current.spaceFloorGeometryVertices.visible = true
        world.current.buildingGeometryOutlines.visible = true
    });
    addVizStateMountHandler(3, "showSpaces", () => {
        world.current.spaceGeometryMeshes.visible = true;
        world.current.selectableObjects.add(world.current.spaceGeometryMeshes)
        world.current.selectableObjects.visible = true;
        world.current.spaceGeometryOutlines.visible = true;
        world.current.spaceGeometryVertices.visible = false;
        world.current.buildingGeometryOutlines.visible = true
    });
    addVizStateMountHandler(4, "showSunPath", () => {
        world.current.buildingGeometryMeshes.visible = true;
        world.current.buildingGeometryOutlines.visible = true;
        world.current.buildingGeometryVertices.visible = true;
        world.current.sunPathDiagram.visible = true;
        world.current.shadingGeometryMeshes.visible = true;
        world.current.shadingGeometryWireframe.visible = true
    });
    addVizStateMountHandler(5, "showERVDucting", () => {
        world.current.buildingGeometryOutlines.visible = true;
        world.current.ventilationGeometry.visible = true
    });
    addVizStateMountHandler(6, "showHotWaterPiping", () => {
        world.current.buildingGeometryOutlines.visible = true;
        world.current.pipeGeometry.visible = true
    });


    // Dismount Handlers for Viz-States
    // ------------------------------------------------------------------------
    addVizStateDismountHandler(0, "hideDefault", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.buildingGeometryMeshes.visible = false;
        world.current.buildingGeometryOutlines.visible = false;
        world.current.buildingGeometryVertices.visible = false;
    });
    addVizStateDismountHandler(1, "hideGeometry", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.buildingGeometryMeshes.visible = false;
        world.current.buildingGeometryOutlines.visible = false;
        world.current.buildingGeometryVertices.visible = false;
    });
    addVizStateDismountHandler(2, "hideSpaceFloors", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.spaceFloorGeometryMeshes.visible = false;
        world.current.spaceFloorGeometryOutlines.visible = false
        world.current.spaceFloorGeometryVertices.visible = false
    });
    addVizStateDismountHandler(3, "hideSpaces", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.spaceGeometryMeshes.visible = false;
        world.current.spaceGeometryOutlines.visible = false;
        world.current.spaceGeometryVertices.visible = false;
        world.current.buildingGeometryOutlines.visible = false;
    });
    addVizStateDismountHandler(4, "hideSunPath", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.buildingGeometryMeshes.visible = false;
        world.current.buildingGeometryOutlines.visible = false;
        world.current.buildingGeometryVertices.visible = false;
        world.current.sunPathDiagram.visible = false;
        world.current.shadingGeometryMeshes.visible = false;
        world.current.shadingGeometryWireframe.visible = false
    });
    addVizStateDismountHandler(5, "hideERVDucting", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.buildingGeometryOutlines.visible = false;
        world.current.ventilationGeometry.visible = false
    });
    addVizStateDismountHandler(6, "hideHotWaterPiping", () => {
        world.current.clearSelectableObjectsGroup()
        world.current.buildingGeometryOutlines.visible = false;
        world.current.pipeGeometry.visible = false
    });

    // Add the Tool-State mount/un-mount and event-listeners
    // ------------------------------------------------------------------------
    useEffect(() => {
        // Run the new Tool-State's mount handlers
        for (const key in appToolStateContext.appToolState.mountHandlers) {
            appToolStateContext.appToolState.mountHandlers[key]();
        }

        // Add the new Tool-State's event listeners
        for (const key in appToolStateContext.appToolState.eventHandlers) {
            const handler: any = appToolStateContext.appToolState.eventHandlers[key];
            window.addEventListener(key, handler);
        }

        // Cleanup function to remove the previous Tool-States' event listeners
        const prevToolState = appToolStateContext.appToolState;
        return () => {
            // Run the previous State's dismount handlers
            for (const key in prevToolState.dismountHandlers) {
                prevToolState.dismountHandlers[key]();
            }

            // Remove the previous state's event listeners
            for (const key in prevToolState.eventHandlers) {
                const handler: any = prevToolState.eventHandlers[key];
                window.removeEventListener(key, handler);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appToolStateContext.appToolState]);


    // Add the Viz-State mount/un-mount and event-listeners
    // ------------------------------------------------------------------------
    useEffect(() => {
        clearSelection(selectedObjectContext, hoverObjectContext)
        // Run the new Viz-State's mount handlers
        for (const key in appVizStateContext.appVizState.mountHandlers) {
            appVizStateContext.appVizState.mountHandlers[key]();
        }

        // Add the new Voz-State's event listeners
        for (const key in appVizStateContext.appVizState.eventHandlers) {
            const handler: any = appVizStateContext.appVizState.eventHandlers[key];
            window.addEventListener(key, handler);
        }

        // Cleanup function to remove the previous Viz-States' view
        const prevVizState = appVizStateContext.appVizState;
        return () => {
            // Run the previous State's dismount handlers
            for (const key in prevVizState.dismountHandlers) {
                prevVizState.dismountHandlers[key]();
            }

            // Remove the previous state's event listeners
            for (const key in prevVizState.eventHandlers) {
                const handler: any = prevVizState.eventHandlers[key];
                window.removeEventListener(key, handler);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appVizStateContext.appVizState]);


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

    return <div id="world" style={{ position: "absolute", top: "0", zIndex: -1 }} ref={mountRef} />

}

export default World;