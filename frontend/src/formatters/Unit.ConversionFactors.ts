export type Unit =
    | 'mm'
    | 'in'
    | 'w/mk'
    | 'btu/hr-ft-F'
    | 'hr-ft2-F/btu-in'
    | 'kg/m3'
    | 'lb/ft3'
    | 'J/kg-K'
    | 'Btu/lb-F';

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
    // Desity
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
};
