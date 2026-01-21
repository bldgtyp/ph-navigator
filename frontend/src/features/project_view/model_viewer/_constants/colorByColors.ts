import * as THREE from 'three';

// Color definition type with display label and hex color
export type ColorDefinition = {
    label: string;
    color: THREE.Color;
    hex: string;
};

// Face Type color definitions
export const faceTypeColors: Record<string, ColorDefinition> = {
    Wall: {
        label: 'Wall',
        color: new THREE.Color(230 / 255, 180 / 255, 60 / 255),
        hex: '#E6B43C',
    },
    RoofCeiling: {
        label: 'Roof / Ceiling',
        color: new THREE.Color(128 / 255, 20 / 255, 20 / 255),
        hex: '#801414',
    },
    Floor: {
        label: 'Floor',
        color: new THREE.Color(128 / 255, 128 / 255, 128 / 255),
        hex: '#808080',
    },
    Aperture: {
        label: 'Aperture',
        color: new THREE.Color(74 / 255, 180 / 255, 255 / 255),
        hex: '#4AB4FF',
    },
    default: {
        label: 'Other',
        color: new THREE.Color(200 / 255, 200 / 255, 200 / 255),
        hex: '#C8C8C8',
    },
};

// Boundary Condition color definitions
export const boundaryColors: Record<string, ColorDefinition> = {
    Outdoors: {
        label: 'Outdoors',
        color: new THREE.Color(64 / 255, 180 / 255, 255 / 255),
        hex: '#40B4FF',
    },
    Ground: {
        label: 'Ground',
        color: new THREE.Color(165 / 255, 82 / 255, 0),
        hex: '#A55200',
    },
    Adiabatic: {
        label: 'Adiabatic',
        color: new THREE.Color(255 / 255, 128 / 255, 128 / 255),
        hex: '#FF8080',
    },
    Surface: {
        label: 'Surface',
        color: new THREE.Color(0, 128 / 255, 0),
        hex: '#008000',
    },
    default: {
        label: 'Other',
        color: new THREE.Color(200 / 255, 200 / 255, 200 / 255),
        hex: '#C8C8C8',
    },
};

// Helper to get legend items for a color map (excludes 'default' from legend display)
export function getLegendItems(colorMap: Record<string, ColorDefinition>): ColorDefinition[] {
    return Object.entries(colorMap)
        .filter(([key]) => key !== 'default')
        .map(([, value]) => value);
}
