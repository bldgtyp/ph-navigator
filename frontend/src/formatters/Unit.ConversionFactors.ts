export const CONVERSION_FACTORS = {
    "mm": {
        "mm": (v: number) => v,
        "in": (v: number) => v / 25.4,
    },
    "in": {
        "mm": (v: number) => v * 25.4,
        "in": (v: number) => v,
    },
}