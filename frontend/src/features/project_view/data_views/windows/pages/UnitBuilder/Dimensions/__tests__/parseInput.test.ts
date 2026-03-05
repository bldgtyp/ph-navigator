import { parseInput } from '../parseInput';

describe('parseInput', () => {
    describe('SI mode (isIPMode = false)', () => {
        it('parses plain number', () => {
            expect(parseInput('24', false)).toBe(24);
        });

        it('parses arithmetic expression', () => {
            expect(parseInput('24 + 12', false)).toBe(36);
        });

        it('ignores feet-inches notation in SI mode', () => {
            // In SI mode, feet-inches markers are passed to arithmetic parser
            // which will return NaN since they are invalid arithmetic
            expect(parseInput('2\' 6"', false)).toBe(NaN);
        });

        it('returns NaN for invalid input', () => {
            expect(parseInput('abc', false)).toBe(NaN);
        });
    });

    describe('IP mode (isIPMode = true)', () => {
        describe('feet-inches notation', () => {
            it("parses 2' as 24 inches", () => {
                expect(parseInput("2'", true)).toBe(24);
            });

            it('parses 6" as 6 inches', () => {
                expect(parseInput('6"', true)).toBe(6);
            });

            it('parses 2\' 6" as 30 inches', () => {
                expect(parseInput('2\' 6"', true)).toBe(30);
            });

            it('parses 6-1/2" as 6.5 inches', () => {
                expect(parseInput('6-1/2"', true)).toBe(6.5);
            });

            it('parses 2\' 6-1/2" as 30.5 inches', () => {
                expect(parseInput('2\' 6-1/2"', true)).toBe(30.5);
            });
        });

        describe('plain numbers and expressions (fallback)', () => {
            it('parses plain number', () => {
                expect(parseInput('24', true)).toBe(24);
            });

            it('parses arithmetic expression', () => {
                expect(parseInput('24 + 12', true)).toBe(36);
            });

            it('parses decimal number', () => {
                expect(parseInput('6.5', true)).toBe(6.5);
            });

            it('parses multiplication', () => {
                expect(parseInput('2 * 12', true)).toBe(24);
            });
        });

        describe('error handling', () => {
            it('returns NaN for empty string', () => {
                expect(parseInput('', true)).toBe(NaN);
            });

            it('returns NaN for whitespace only', () => {
                expect(parseInput('   ', true)).toBe(NaN);
            });

            it('returns NaN for invalid input', () => {
                expect(parseInput('abc', true)).toBe(NaN);
            });
        });
    });

    describe('disambiguation: feet-inches vs arithmetic', () => {
        it('6-1/2" is feet-inches in IP mode (6.5 inches)', () => {
            expect(parseInput('6-1/2"', true)).toBe(6.5);
        });

        it('6-1/2 (no marker) is arithmetic in IP mode (5.5)', () => {
            // This is 6 - 1 / 2 = 6 - 0.5 = 5.5 as arithmetic
            // (evaluateSimpleExpression handles operator precedence correctly)
            expect(parseInput('6-1/2', true)).toBe(5.5);
        });

        it('24 + 12 is arithmetic (no markers)', () => {
            expect(parseInput('24 + 12', true)).toBe(36);
        });
    });
});
