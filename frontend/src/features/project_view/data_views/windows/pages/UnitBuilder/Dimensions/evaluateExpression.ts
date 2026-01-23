/**
 * Safely evaluate a simple arithmetic expression.
 * Supports: numbers and chained operations with +, -, *, /
 * Respects operator precedence (* and / before + and -)
 * Returns NaN if expression is invalid.
 *
 * Examples:
 *   "100" → 100
 *   "100 + 50" → 150
 *   "1 + 2 + 3" → 6
 *   "2 + 3 * 4" → 14 (not 20, respects precedence)
 *   "100 / 4" → 25
 *
 * Security: Uses whitelist approach - only digits, decimal points,
 * operators (+, -, *, /), and spaces are allowed. No eval() or Function().
 */
export function evaluateSimpleExpression(input: string): number {
    const trimmed = input.trim();

    // Fast path: simple number (most common case)
    if (/^-?\d+\.?\d*$/.test(trimmed)) {
        return parseFloat(trimmed);
    }

    // Validate: only allowed characters (digits, operators, decimal, spaces)
    if (!/^[\d\s+\-*/.]+$/.test(trimmed)) {
        return NaN;
    }

    // Tokenize: extract numbers and operators
    const tokens = trimmed.match(/(\d+\.?\d*|[+\-*/])/g);
    if (!tokens || tokens.length === 0) {
        return NaN;
    }

    // Validate token structure: must be number, op, number, op, number...
    // (odd number of tokens, alternating types)
    if (tokens.length % 2 === 0) {
        return NaN; // Even number means incomplete expression
    }

    // Parse into numbers and operators
    const numbers: number[] = [];
    const operators: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        if (i % 2 === 0) {
            // Should be a number
            const num = parseFloat(tokens[i]);
            if (isNaN(num)) {
                return NaN;
            }
            numbers.push(num);
        } else {
            // Should be an operator
            if (!['+', '-', '*', '/'].includes(tokens[i])) {
                return NaN;
            }
            operators.push(tokens[i]);
        }
    }

    // First pass: handle * and / (higher precedence)
    let i = 0;
    while (i < operators.length) {
        if (operators[i] === '*' || operators[i] === '/') {
            const left = numbers[i];
            const right = numbers[i + 1];
            let result: number;

            if (operators[i] === '*') {
                result = left * right;
            } else {
                if (right === 0) {
                    return NaN; // Division by zero
                }
                result = left / right;
            }

            // Replace the two numbers with the result
            numbers.splice(i, 2, result);
            operators.splice(i, 1);
            // Don't increment i - check same position again
        } else {
            i++;
        }
    }

    // Second pass: handle + and - (left to right)
    let result = numbers[0];
    for (let j = 0; j < operators.length; j++) {
        if (operators[j] === '+') {
            result += numbers[j + 1];
        } else if (operators[j] === '-') {
            result -= numbers[j + 1];
        }
    }

    return result;
}
