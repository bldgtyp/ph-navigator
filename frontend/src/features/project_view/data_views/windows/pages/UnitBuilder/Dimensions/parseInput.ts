/**
 * Orchestration layer for parsing dimension inputs.
 *
 * Routes to the appropriate parser based on unit mode and input format:
 * - SI mode: Always uses evaluateSimpleExpression
 * - IP mode with feet-inches markers: Tries parseFeetInches first
 * - Fallback: evaluateSimpleExpression for plain numbers/expressions
 */

import { evaluateSimpleExpression } from './evaluateExpression';
import { containsFeetInchesNotation, parseFeetInches } from './parseFeetInches';

/**
 * Parse a dimension input string into a numeric value.
 *
 * @param input - The user's input string
 * @param isIPMode - Whether the app is in Imperial (IP) mode
 * @returns The parsed numeric value, or NaN if invalid
 */
export function parseInput(input: string, isIPMode: boolean): number {
    const trimmed = input.trim();

    if (!trimmed) {
        return NaN;
    }

    // SI mode: always use arithmetic expression parser
    if (!isIPMode) {
        return evaluateSimpleExpression(trimmed);
    }

    // IP mode: check for feet-inches notation
    if (containsFeetInchesNotation(trimmed)) {
        const result = parseFeetInches(trimmed);
        if (result !== null) {
            return result;
        }
        // If feet-inches parsing failed but markers were present,
        // return NaN rather than trying arithmetic (user likely made a typo)
        return NaN;
    }

    // IP mode without feet-inches markers: use arithmetic expression parser
    return evaluateSimpleExpression(trimmed);
}
