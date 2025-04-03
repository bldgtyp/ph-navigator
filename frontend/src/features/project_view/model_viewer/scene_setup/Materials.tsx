import * as THREE from 'three';
import { appColors } from '../../../../styles/AppColors';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export const appMaterials = {
    // Surfaces ---------------------------------------------------------------
    groundShadow: new THREE.ShadowMaterial(
        {
            opacity: 0.3,
            transparent: true,
        }),
    geometryStandard: new THREE.MeshStandardMaterial(
        {
            color: appColors.SURFACE_WHITE,
            side: THREE.DoubleSide,
            flatShading: true,
        }),
    geometryWindow: new THREE.MeshStandardMaterial(
        {
            color: appColors.SURFACE_WHITE,
            opacity: 0.85,
            transparent: true,
            side: THREE.DoubleSide,
        }),
    geometryShading: new THREE.MeshStandardMaterial(
        {
            color: appColors.MED_GREY,
            side: THREE.DoubleSide,
            flatShading: true,
        }),
    geometrySelected: new THREE.MeshStandardMaterial(
        {
            color: appColors.SURFACE_HIGHLIGHT,
            side: THREE.DoubleSide,
        }),
    geometryHoverOver: new THREE.MeshStandardMaterial(
        {
            color: appColors.SURFACE_HOVER,
            side: THREE.DoubleSide,
        }),

    // Lines ------------------------------------------------------------------
    wireframe: new THREE.LineBasicMaterial(
        {
            color: appColors.OUTLINE,
            linewidth: 2,
        }),
    wireframeDarkGrey: new THREE.LineBasicMaterial(
        {
            color: appColors.DARK_GREY,
            linewidth: 2,
        }),
    dimensionLine: new THREE.LineBasicMaterial(
        {
            color: appColors.DIMENSION_LINE,
            linewidth: 2,
        }),
    sunpathLine: new THREE.LineDashedMaterial(
        {
            color: appColors.SUNPATH_LINE,
            linewidth: 2,
            scale: 1,
            dashSize: 1,
            gapSize: 0.5,
        }),
    pipeLine: new LineMaterial(
        {
            color: appColors.PIPE_LINE,
            linewidth: 0.04,
            worldUnits: true
        }),
    pipeLineHighlight: new LineMaterial(
        {
            color: appColors.PIPE_LINE_HIGHLIGHT,
            linewidth: 0.1,
            worldUnits: true
        }),
    ductLine: new LineMaterial(
        {
            color: appColors.DUCT_LINE,
            linewidth: 0.06,
            worldUnits: true
        }),
}