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

// Ventilation Airflow color definitions
export const ventilationAirflowColors: Record<string, ColorDefinition> = {
    SupplyOnly: {
        label: 'Supply Only',
        color: new THREE.Color(140 / 255, 206 / 255, 254 / 255),
        hex: '#8CCEFE',
    },
    ExtractOnly: {
        label: 'Extract Only',
        color: new THREE.Color(254 / 255, 140 / 255, 140 / 255),
        hex: '#FE8C8C',
    },
    SupplyAndExtract: {
        label: 'Supply & Extract',
        color: new THREE.Color(232 / 255, 140 / 255, 248 / 255),
        hex: '#E88CF8',
    },
    NoVentilation: {
        label: 'No Ventilation',
        color: new THREE.Color(200 / 255, 200 / 255, 200 / 255),
        hex: '#C8C8C8',
    },
    default: {
        label: 'Unknown',
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

/**
 * Generates a high-quality hash from a string using cyrb53 algorithm.
 * Produces well-distributed values even for similar input strings.
 */
function cyrb53(str: string, seed: number = 0): number {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Generates a deterministic color from a string using a high-quality hash.
 * Uses HSL color space and golden ratio distribution for visually distinct colors,
 * even for similar input strings like "N.3.1", "N.3.2", etc.
 */
export function stringToColor(str: string): THREE.Color {
    // Generate multiple hash values for better distribution
    const hash1 = cyrb53(str, 0);
    const hash2 = cyrb53(str, hash1);

    // Use golden ratio for optimal hue distribution
    // This ensures consecutive/similar names get spread across the color wheel
    const goldenRatio = 0.618033988749895;
    const baseHue = (hash1 % 1000) / 1000;
    const hue = (baseHue + goldenRatio * (hash2 % 100)) % 1.0;

    // Use different hash bits for saturation and lightness
    const saturation = 0.55 + ((hash1 >>> 20) % 30) / 100; // 55-85%
    const lightness = 0.4 + ((hash2 >>> 20) % 25) / 100; // 40-65%

    return new THREE.Color().setHSL(hue, saturation, lightness);
}

/**
 * Converts a THREE.Color to hex string for CSS.
 */
export function colorToHex(color: THREE.Color): string {
    return '#' + color.getHexString();
}

/**
 * Creates a ColorDefinition from a construction name.
 */
export function createConstructionColorDef(name: string): ColorDefinition {
    const color = stringToColor(name);
    return {
        label: name,
        color: color,
        hex: colorToHex(color),
    };
}
