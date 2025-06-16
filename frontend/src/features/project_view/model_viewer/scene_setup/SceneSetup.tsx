import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { appColors } from '../../../../styles/AppColors';
import { appMaterials } from './Materials';
import { defaultLightConfiguration } from './Lighting';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class SceneSetup {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    labelRenderer: CSS2DRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    composer: EffectComposer;
    saoPass: SAOPass;

    selectableObjects: THREE.Group;
    groundGeometry: THREE.Group;
    buildingGeometryMeshes: THREE.Group;
    buildingGeometryOutlines: THREE.Group;
    buildingGeometryVertices: THREE.Group;
    spaceGeometryMeshes: THREE.Group;
    spaceGeometryOutlines: THREE.Group;
    spaceGeometryVertices: THREE.Group;
    spaceFloorGeometryMeshes: THREE.Group;
    spaceFloorGeometryOutlines: THREE.Group;
    spaceFloorGeometryVertices: THREE.Group;
    sunPathDiagram: THREE.Group;
    pipeGeometry: THREE.Group;
    ventilationGeometry: THREE.Group;
    shadingGeometryMeshes: THREE.Group;
    shadingGeometryWireframe: THREE.Group;

    constructor() {
        // -- Scene
        this.scene = new THREE.Scene();
        this.scene.background = appColors.BACKGROUND;
        this.selectableObjects = new THREE.Group();
        this.selectableObjects.visible = true;
        this.scene.add(this.selectableObjects);

        // -- Camera
        const FOV = 45;
        this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(-25, 40, 30);
        this.camera.lookAt(0, 0, 0);
        this.camera.up.set(0, 0, 1);

        // -- Geometry Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio * 2); // Improves line quality

        // -- Scene Composer
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.saoPass = new SAOPass(this.scene, this.camera);
        // this.saoPass.params.output = SAOPass.OUTPUT.Default
        // this.saoPass.params.saoBias = 1.0;
        // this.saoPass.params.saoIntensity = 0.004;
        // this.saoPass.params.saoScale = 8.0;
        // this.saoPass.params.saoKernelRadius = 25;
        // this.saoPass.params.saoMinResolution = 0.0;
        // this.saoPass.params.saoBlur = true;
        // this.saoPass.params.saoBlurRadius = 100;
        // this.saoPass.params.saoBlurStdDev = 4;
        // this.saoPass.params.saoBlurDepthCutoff = 0.0;

        // This is not working well... too slow, and too shitty...
        // Lines get all un-antialiased and jagged
        // this.composer.addPass(this.saoPass);
        // const outputPass = new OutputPass();
        // this.composer.addPass(outputPass);

        // -- Shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // LabelRendered
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(this.labelRenderer.domElement);

        // -- Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.rotateSpeed = 0.9;
        this.controls.zoomSpeed = 3.0;

        // -- Grid Helpers
        const grid = new THREE.Group();

        const grid1 = new THREE.GridHelper(50, 50);
        grid1.material.color.set(appColors.GRID_LINE_LIGHT);
        grid1.material.vertexColors = false;
        grid.add(grid1);

        const grid2 = new THREE.GridHelper(50, 5);
        grid2.material.color.set(appColors.GRID_LINE_DARK);
        grid2.material.vertexColors = false;
        grid.add(grid2);

        grid.rotateX(Math.PI / 2);
        this.scene.add(grid);

        // --- Hemisphere Light
        const light_1 = new THREE.AmbientLight(
            appColors.SURFACE_WHITE,
            defaultLightConfiguration.indirectLightIntensity
        );
        this.scene.add(light_1);

        // -- Sunlight
        const light_2 = new THREE.DirectionalLight(
            defaultLightConfiguration.color,
            defaultLightConfiguration.intensity
        );
        light_2.position.set(-10, -10, 25);
        light_2.castShadow = defaultLightConfiguration.castShadow;
        light_2.shadow.camera.updateProjectionMatrix();
        light_2.shadow.camera.top = 25;
        light_2.shadow.camera.bottom = -25;
        light_2.shadow.camera.left = -25;
        light_2.shadow.camera.right = 25;

        this.scene.add(light_2);

        // -- Ground
        this.groundGeometry = new THREE.Group();
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), appMaterials.groundShadow);
        ground.receiveShadow = true;
        this.groundGeometry.add(ground);
        this.scene.add(this.groundGeometry);

        // -- Groups for the Loaded Geometry
        this.buildingGeometryMeshes = new THREE.Group();
        this.buildingGeometryMeshes.name = 'Building Geometry | Meshes';
        this.scene.add(this.buildingGeometryMeshes);

        this.buildingGeometryOutlines = new THREE.Group();
        this.buildingGeometryOutlines.name = 'Building Geometry | Outlines';
        this.scene.add(this.buildingGeometryOutlines);

        this.buildingGeometryVertices = new THREE.Group();
        this.buildingGeometryVertices.name = 'Building Geometry | Vertices';
        this.scene.add(this.buildingGeometryVertices);

        this.sunPathDiagram = new THREE.Group();
        this.sunPathDiagram.name = 'Sun Path Diagram';
        this.scene.add(this.sunPathDiagram);

        // ----
        this.spaceGeometryMeshes = new THREE.Group();
        this.spaceGeometryMeshes.name = 'Space Geometry | Meshes';
        this.scene.add(this.spaceGeometryMeshes);

        this.spaceGeometryOutlines = new THREE.Group();
        this.spaceGeometryOutlines.name = 'Space Geometry | Outlines';
        this.scene.add(this.spaceGeometryOutlines);

        this.spaceGeometryVertices = new THREE.Group();
        this.spaceGeometryVertices.name = 'Space Geometry | Vertices';
        this.scene.add(this.spaceGeometryVertices);

        // ----
        this.spaceFloorGeometryMeshes = new THREE.Group();
        this.spaceFloorGeometryMeshes.name = 'SpaceFloor Geometry | Meshes';
        this.scene.add(this.spaceFloorGeometryMeshes);

        this.spaceFloorGeometryOutlines = new THREE.Group();
        this.spaceFloorGeometryOutlines.name = 'SpaceFloor Geometry | Outlines';
        this.scene.add(this.spaceFloorGeometryOutlines);

        this.spaceFloorGeometryVertices = new THREE.Group();
        this.spaceFloorGeometryVertices.name = 'SpaceFloor Geometry | Vertices';
        this.scene.add(this.spaceFloorGeometryVertices);

        // ---
        this.pipeGeometry = new THREE.Group();
        this.pipeGeometry.name = 'Pipe Geometry';
        this.scene.add(this.pipeGeometry);

        this.ventilationGeometry = new THREE.Group();
        this.ventilationGeometry.name = 'Ventilation Geometry';
        this.scene.add(this.ventilationGeometry);

        // ---
        this.shadingGeometryMeshes = new THREE.Group();
        this.shadingGeometryMeshes.name = 'Shading Geometry | Meshes';
        this.scene.add(this.shadingGeometryMeshes);

        this.shadingGeometryWireframe = new THREE.Group();
        this.shadingGeometryWireframe.name = 'Shading Geometry | Outlines';
        this.scene.add(this.shadingGeometryWireframe);

        // -- Show Helpers
        // const lightHelper = new THREE.DirectionalLightHelper(light_2, 5);
        // this.scene.add(lightHelper);

        // const shadowHelper = new THREE.CameraHelper(light_2.shadow.camera);
        // this.scene.add(shadowHelper);
    }

    reset() {
        this.buildingGeometryMeshes.clear();
        this.buildingGeometryOutlines.clear();
        this.buildingGeometryVertices.clear();
        this.spaceGeometryMeshes.clear();
        this.spaceGeometryOutlines.clear();
        this.spaceGeometryVertices.clear();
        this.sunPathDiagram.clear();
        this.pipeGeometry.clear();
        this.ventilationGeometry.clear();
        this.shadingGeometryMeshes.clear();
    }

    /**
     * Clears the selectable objects group by adding each child back to the scene.
     * Because any THREE object can only have one parent, moving it back to the scene
     * will remove it from the selectable objects group.
     */
    clearSelectableObjectsGroup() {
        this.selectableObjects.children.forEach((child: any) => {
            this.scene.add(child);
        });
    }
}
