import { containsFeetInchesNotation, parseFeetInches } from '../parseFeetInches';

describe('containsFeetInchesNotation', () => {
    it('returns true for feet marker', () => {
        expect(containsFeetInchesNotation("2'")).toBe(true);
    });

    it('returns true for inch marker', () => {
        expect(containsFeetInchesNotation('6"')).toBe(true);
    });

    it('returns true for both markers', () => {
        expect(containsFeetInchesNotation('2\' 6"')).toBe(true);
    });

    it('returns false for plain number', () => {
        expect(containsFeetInchesNotation('24')).toBe(false);
    });

    it('returns false for arithmetic expression', () => {
        expect(containsFeetInchesNotation('24 + 12')).toBe(false);
    });

    it('handles curly quotes', () => {
        expect(containsFeetInchesNotation('2\u2019')).toBe(true); // curly apostrophe
        expect(containsFeetInchesNotation('6\u201D')).toBe(true); // curly double quote
    });
});

describe('parseFeetInches', () => {
    describe('feet only', () => {
        it("parses 2' as 24 inches", () => {
            expect(parseFeetInches("2'")).toBe(24);
        });

        it("parses 3' as 36 inches", () => {
            expect(parseFeetInches("3'")).toBe(36);
        });

        it("parses 0' as 0 inches", () => {
            expect(parseFeetInches("0'")).toBe(0);
        });
    });

    describe('inches only', () => {
        it('parses 6" as 6 inches', () => {
            expect(parseFeetInches('6"')).toBe(6);
        });

        it('parses 12" as 12 inches', () => {
            expect(parseFeetInches('12"')).toBe(12);
        });

        it('parses 6.5" as 6.5 inches', () => {
            expect(parseFeetInches('6.5"')).toBe(6.5);
        });
    });

    describe('feet and inches combined', () => {
        it('parses 2\' 6" as 30 inches', () => {
            expect(parseFeetInches('2\' 6"')).toBe(30);
        });

        it('parses 2\'6" (no space) as 30 inches', () => {
            expect(parseFeetInches('2\'6"')).toBe(30);
        });

        it('parses 3\'-4" as 40 inches', () => {
            expect(parseFeetInches('3\'-4"')).toBe(40);
        });

        it('parses 1\' 0" as 12 inches', () => {
            expect(parseFeetInches('1\' 0"')).toBe(12);
        });
    });

    describe('fractions', () => {
        it('parses 1/2" as 0.5 inches', () => {
            expect(parseFeetInches('1/2"')).toBe(0.5);
        });

        it('parses 3/4" as 0.75 inches', () => {
            expect(parseFeetInches('3/4"')).toBe(0.75);
        });

        it('parses 1/8" as 0.125 inches', () => {
            expect(parseFeetInches('1/8"')).toBe(0.125);
        });

        it('parses 6-1/2" as 6.5 inches', () => {
            expect(parseFeetInches('6-1/2"')).toBe(6.5);
        });

        it('parses 6 1/2" (space-separated) as 6.5 inches', () => {
            expect(parseFeetInches('6 1/2"')).toBe(6.5);
        });

        it('parses 24 3/8" as 24.375 inches', () => {
            expect(parseFeetInches('24 3/8"')).toBe(24.375);
        });
    });

    describe('complex formats', () => {
        it('parses 2\' 6-1/2" as 30.5 inches', () => {
            expect(parseFeetInches('2\' 6-1/2"')).toBe(30.5);
        });

        it('parses 2\' 6.5" as 30.5 inches', () => {
            expect(parseFeetInches('2\' 6.5"')).toBe(30.5);
        });

        it('parses 1\' 3/4" as 12.75 inches', () => {
            expect(parseFeetInches('1\' 3/4"')).toBe(12.75);
        });
    });

    describe('whitespace handling', () => {
        it('trims leading/trailing whitespace', () => {
            expect(parseFeetInches('  2\' 6"  ')).toBe(30);
        });

        it('handles multiple spaces between feet and inches', () => {
            expect(parseFeetInches('2\'   6"')).toBe(30);
        });
    });

    describe('curly/smart quote normalization', () => {
        it('handles curly apostrophe for feet', () => {
            expect(parseFeetInches('2\u2019')).toBe(24); // right single quote
        });

        it('handles curly double quote for inches', () => {
            expect(parseFeetInches('6\u201D')).toBe(6); // right double quote
        });
    });

    describe('non-feet-inches input', () => {
        it('returns null for plain number', () => {
            expect(parseFeetInches('24')).toBe(null);
        });

        it('returns null for arithmetic expression', () => {
            expect(parseFeetInches('24 + 12')).toBe(null);
        });

        it('returns null for empty string', () => {
            expect(parseFeetInches('')).toBe(null);
        });
    });
});
