import { convertValue } from '../../../../../../../formatters/Unit.Converter';
import { evaluateSimpleExpression } from './evaluateExpression';
import { formatFeetInches } from './formatFeetInches';
import { parseInput } from './parseInput';

import type { Unit } from '../../../../../../../formatters/Unit.ConversionFactors';
import type { DisplayUnit } from './types';

interface FormatConfig {
    decimals: number;
    toDisplay: (valueMM: number) => number;
}

const NUMERIC_FORMAT: Record<Exclude<DisplayUnit, 'ft-in'>, FormatConfig> = {
    mm: { decimals: 1, toDisplay: v => v },
    cm: { decimals: 2, toDisplay: v => convertValue(v, 'mm', 'cm') },
    m: { decimals: 4, toDisplay: v => convertValue(v, 'mm', 'm') },
    in: { decimals: 2, toDisplay: v => convertValue(v, 'mm', 'in') },
    ft: { decimals: 3, toDisplay: v => convertValue(v, 'mm', 'ft') },
};

/**
 * Format a value stored in mm for display in the given display unit.
 */
export function formatValueForDisplay(valueMM: number, displayUnit: DisplayUnit, decimals?: number): string {
    if (displayUnit === 'ft-in') {
        return formatFeetInches(valueMM);
    }
    const config = NUMERIC_FORMAT[displayUnit];
    const dec = decimals ?? config.decimals;
    return config.toDisplay(valueMM).toFixed(dec);
}

/** Evaluate an expression and convert from `fromUnit` to mm. */
function evaluateAndConvertToMM(input: string, fromUnit: Unit): number {
    const val = evaluateSimpleExpression(input);
    if (isNaN(val)) return NaN;
    return fromUnit === 'mm' ? val : convertValue(val, fromUnit, 'mm');
}

/** Parse an IP-mode input (supports feet-inches notation) and convert to mm. */
function parseIPInputToMM(input: string): number {
    const val = parseInput(input, true);
    return isNaN(val) ? NaN : val * 25.4;
}

/**
 * Parse a user-entered string (in the given display unit) back to mm.
 * Returns NaN if the input is invalid.
 */
export function parseDisplayUnitToMM(input: string, displayUnit: DisplayUnit): number {
    const trimmed = input.trim();
    if (!trimmed) return NaN;

    switch (displayUnit) {
        case 'mm':
        case 'cm':
        case 'm':
        case 'ft':
            return evaluateAndConvertToMM(trimmed, displayUnit);
        case 'in':
        case 'ft-in':
            return parseIPInputToMM(trimmed);
    }
}
