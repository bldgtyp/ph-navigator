import { convertValue } from '../../../formatters/Unit.Converter';
import { Unit } from '../../../formatters/Unit.ConversionFactors';
import { useUnitSystem } from '../_contexts/UnitSystemContext';

/**
 * Hook for handling unit conversions based on user's unit system preference
 */
export function useUnitConversion() {
    const { unitSystem } = useUnitSystem();

    /**
     * Converts a numeric value from its SI unit to the appropriate unit based on the current unit system.
     *
     * @param value - The numeric value to be converted.
     * @param siUnit - The SI unit of the value.
     * @param ipUnit - The Imperial/US Customary unit equivalent.
     * @returns The value converted to the unit corresponding to the current unit system.
     */
    function valueInCurrentUnitSystem(value: number, siUnit: Unit, ipUnit: Unit): number {
        return convertValue(value, siUnit, unitSystem === 'SI' ? siUnit : ipUnit);
    }

    /**
     * Converts a numeric value from SI units to the current unit system (SI or IP),
     * and formats the result as a string with a specified number of decimal places.
     *
     * @param value - The numeric value to convert or null.
     * @param siUnit - The SI unit of the value.
     * @param ipUnit - The IP unit to convert to if the current unit system is IP.
     * @param decimal - The number of decimal places to format the result. If `null`, no formatting is applied.
     * @returns The converted value as a string, formatted to the specified number of decimal places.
     */
    function valueInCurrentUnitSystemWithDecimal(
        value: number | null | undefined,
        siUnit: Unit,
        ipUnit: Unit,
        decimal: number
    ): string {
        if (value === null || value === undefined) {
            return '-';
        }

        const newValue = convertValue(value, siUnit, unitSystem === 'SI' ? siUnit : ipUnit);
        if (decimal === null) {
            return newValue.toString();
        } else {
            return newValue.toFixed(decimal);
        }
    }

    /**
     * Converts a given value to SI units based on the current unit system.
     *
     * @param value - The numeric value to be converted.
     * @param siUnit - The unit representing the SI (International System of Units) equivalent.
     * @param ipUnit - The unit representing the IP (Imperial/US Customary) equivalent.
     * @returns The value converted to SI units.
     */
    function valueInSIUnits(value: number, siUnit: Unit, ipUnit: Unit): number {
        return convertValue(value, unitSystem === 'SI' ? siUnit : ipUnit, siUnit);
    }

    return {
        valueInCurrentUnitSystem,
        valueInCurrentUnitSystemWithDecimal,
        valueInSIUnits,
        unitSystem,
    };
}
