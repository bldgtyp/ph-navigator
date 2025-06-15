import { Unit, CONVERSION_FACTORS } from './Unit.ConversionFactors';

export function convertValue(value: number, fromUnit: Unit, toUnit: Unit): number {
    if (fromUnit === toUnit) {
        return value;
    }
    const conversionFunction = CONVERSION_FACTORS[fromUnit][toUnit];
    if (!conversionFunction) {
        throw new Error(`Conversion from ${fromUnit} to ${toUnit} not supported.`);
    }
    return conversionFunction(value);
}
