export type Unit =
    | "mm"
    | "in"
    | "w/mk"
    | "btu/hr-ft-F"
    | "hr-ft2-F/btu-in";

type ConversionFunction = (v: number) => number;

type ConversionMap = {
    [K in Unit]: {
        [J in Unit]?: ConversionFunction;
    }
};

export const CONVERSION_FACTORS: ConversionMap = {
    "mm": {
        "mm": (v: number) => v,
        "in": (v: number) => v / 25.4,
    },
    "in": {
        "mm": (v: number) => v * 25.4,
        "in": (v: number) => v,
    },
    "w/mk": {
        "w/mk": (v: number) => v,
        "btu/hr-ft-F": (v: number) => v * 0.577789236,
        "hr-ft2-F/btu-in": (v: number) => 1 / (v * 0.577789236 * 12),
    },
    "btu/hr-ft-F": {
        "w/mk": (v: number) => v / 0.577789236,
        "btu/hr-ft-F": (v: number) => v,
        "hr-ft2-F/btu-in": (v: number) => v * 12 * 0.577789236,
    },
    "hr-ft2-F/btu-in": {
        "w/mk": (v: number) => 1 / (v * 0.577789236 * 12),
        "btu/hr-ft-F": (v: number) => v / (12 * 0.577789236),
        "hr-ft2-F/btu-in": (v: number) => v,
    },
};