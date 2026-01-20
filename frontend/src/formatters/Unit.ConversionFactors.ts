export type Unit =
    | 'mm'
    | 'in'
    | 'm2'
    | 'ft2'
    | 'm3'
    | 'ft3'
    | 'w/mk'
    | 'w/m2k'
    | 'btu/hr-ft-F'
    | 'btu/hr-ft2-F'
    | 'hr-ft2-F/btu-in'
    | 'm2k/w'
    | 'hr-ft2-F/btu'
    | 'kg/m3'
    | 'lb/ft3'
    | 'J/kg-K'
    | 'Btu/lb-F'
    | 'm3_hr_m2'
    | 'cfm_ft2'
    | 'm3_hr'
    | 'cfm';

type ConversionFunction = (v: number) => number;

type ConversionMap = {
    [K in Unit]: {
        [J in Unit]?: ConversionFunction;
    };
};

export const CONVERSION_FACTORS: ConversionMap = {
    // Length
    mm: {
        mm: (v: number) => v,
        in: (v: number) => v / 25.4,
    },
    in: {
        mm: (v: number) => v * 25.4,
        in: (v: number) => v,
    },
    // Area
    m2: {
        m2: (v: number) => v,
        ft2: (v: number) => v * 10.763910417,
    },
    ft2: {
        m2: (v: number) => v / 10.763910417,
        ft2: (v: number) => v,
    },
    // Volume
    m3: {
        m3: (v: number) => v,
        ft3: (v: number) => v * 35.314666721,
    },
    ft3: {
        m3: (v: number) => v / 35.314666721,
        ft3: (v: number) => v,
    },
    // Thermal Conductivity
    'w/mk': {
        'w/mk': (v: number) => v,
        'btu/hr-ft-F': (v: number) => v * 0.577789236,
        'hr-ft2-F/btu-in': (v: number) => 1 / (v * 0.577789236 * 12),
    },
    'btu/hr-ft-F': {
        'w/mk': (v: number) => v / 0.577789236,
        'btu/hr-ft-F': (v: number) => v,
        'hr-ft2-F/btu-in': (v: number) => v * 12 * 0.577789236,
    },
    'hr-ft2-F/btu-in': {
        'w/mk': (v: number) => 1 / (v * 0.577789236 * 12),
        'btu/hr-ft-F': (v: number) => v / (12 * 0.577789236),
        'hr-ft2-F/btu-in': (v: number) => v,
    },
    // Thermal Transmittance (U-Value)
    'w/m2k': {
        'w/m2k': (v: number) => v,
        'btu/hr-ft2-F': (v: number) => v * 0.176110159,
    },
    'btu/hr-ft2-F': {
        'w/m2k': (v: number) => v * 5.678264134,
        'btu/hr-ft2-F': (v: number) => v,
    },
    // Thermal Resistance (R-Value)
    // R-value SI: m2-K/W (square meter Kelvin per Watt)
    // R-value IP: hr-ft2-F/BTU (hour square foot Fahrenheit per BTU)
    // Conversion: 1 m2-K/W = 5.678263337 hr-ft2-F/BTU
    'm2k/w': {
        'm2k/w': (v: number) => v,
        'hr-ft2-F/btu': (v: number) => v * 5.678263337,
    },
    'hr-ft2-F/btu': {
        'm2k/w': (v: number) => v / 5.678263337,
        'hr-ft2-F/btu': (v: number) => v,
    },
    // Density
    'kg/m3': {
        'kg/m3': (v: number) => v,
        'lb/ft3': (v: number) => v * 0.06242796,
    },
    'lb/ft3': {
        'kg/m3': (v: number) => v / 0.06242796,
        'lb/ft3': (v: number) => v,
    },
    // Specific Heat Capacity
    'J/kg-K': {
        'J/kg-K': (v: number) => v,
        'Btu/lb-F': (v: number) => v * 0.0002388458966275,
    },
    'Btu/lb-F': {
        'J/kg-K': (v: number) => v / 0.0002388458966275,
        'Btu/lb-F': (v: number) => v,
    },
    // Air Infiltration
    m3_hr_m2: {
        m3_hr_m2: (v: number) => v,
        cfm_ft2: (v: number) => v * 0.054680665,
    },
    cfm_ft2: {
        m3_hr_m2: (v: number) => v / 0.054680665,
        cfm_ft2: (v: number) => v,
    },
    // Volume Flow Rate
    m3_hr: {
        m3_hr: (v: number) => v,
        cfm: (v: number) => v * 0.588577779,
    },
    cfm: {
        m3_hr: (v: number) => v / 0.588577779,
        cfm: (v: number) => v,
    },
};
