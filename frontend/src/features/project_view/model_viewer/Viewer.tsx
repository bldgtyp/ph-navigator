// The 3D Model Viewer
// Setup all the contexts, navbars, controls, and state handlers

import * as THREE from 'three';
import { useRef, useState } from 'react';

import { SceneSetup } from './scene_setup/SceneSetup';
import World from './World';
import Model from './Model';
import BottomMenubar from './components/BottomMenubar';
import { AppStateContextProvider } from './contexts/app_viz_state_context';
import { AppToolStateContextProvider } from './contexts/app_tool_state_context';
import { SelectedObjectContextProvider } from './contexts/selected_object_context';
import { HoverObjectContextProvider } from './contexts/hover_object_context';

export default function Viewer(params: any) {
    console.log("Rendering Viewer Component...");

    const [showModel, setShowModel] = useState(true);
    const world = useRef(new SceneSetup());

    // THREE.js Dimension Lines
    const hoveringVertex = useRef<THREE.Vector3 | null>(null);
    const dimensionLinesRef = useRef(new THREE.Group());
    world.current.scene.add(dimensionLinesRef.current);

    return (
        <>
            <AppStateContextProvider>
                <AppToolStateContextProvider>
                    <SelectedObjectContextProvider>
                        <HoverObjectContextProvider>
                            <World world={world} hoveringVertex={hoveringVertex} dimensionLinesRef={dimensionLinesRef} />
                            <Model world={world} showModel={showModel} />
                        </HoverObjectContextProvider>
                    </SelectedObjectContextProvider>
                    <BottomMenubar />
                </AppToolStateContextProvider>
            </AppStateContextProvider>
        </>
    )
}