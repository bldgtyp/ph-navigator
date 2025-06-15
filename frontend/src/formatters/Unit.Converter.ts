import { Unit } from "./Unit.Types";
import { CONVERSION_FACTORS } from "./Unit.ConversionFactors";


export function convertValue(value: number, fromUnit: Unit, toUnit: Unit): number {
    if (fromUnit === toUnit) {
        return value;
    }
    const conversionFunction = CONVERSION_FACTORS[fromUnit][toUnit];
    return conversionFunction(value);
}
