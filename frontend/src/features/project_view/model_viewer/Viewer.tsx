// The 3D Model Viewer
// Setup all the contexts, navbars, controls, and state handlers

import * as THREE from 'three';
import { useRef, useEffect, useState } from 'react';
import { Route, Routes, useParams, useNavigate } from "react-router-dom";

import { SceneSetup } from './scene_setup/SceneSetup';
import World from './World';
import Model from './Model';


export default function Viewer(params: any) {
    console.log("Rendering Viewer Component...");

    const { teamId, projectId } = useParams();
    const [showModel, setShowModel] = useState(true);
    const world = useRef(new SceneSetup());

    return (
        <>
            <World world={world} />
            <Model world={world} showModel={showModel} />
        </>
    )
}