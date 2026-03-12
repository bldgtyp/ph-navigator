import { formatValueForDisplay, parseDisplayUnitToMM } from '../displayUnitConverter';

describe('formatValueForDisplay', () => {
    describe('mm', () => {
        it('formats with 1 decimal by default', () => {
            expect(formatValueForDisplay(1234.5, 'mm')).toBe('1234.5');
        });

        it('respects custom decimals', () => {
            expect(formatValueForDisplay(1234.5678, 'mm', 3)).toBe('1234.568');
        });
    });

    describe('cm', () => {
        it('converts mm to cm with 2 decimals', () => {
            expect(formatValueForDisplay(1234, 'cm')).toBe('123.40');
        });
    });

    describe('m', () => {
        it('converts mm to m with 4 decimals', () => {
            expect(formatValueForDisplay(1234, 'm')).toBe('1.2340');
        });
    });

    describe('in', () => {
        it('converts mm to inches with 2 decimals', () => {
            expect(formatValueForDisplay(25.4, 'in')).toBe('1.00');
        });
    });

    describe('ft', () => {
        it('converts mm to feet with 3 decimals', () => {
            expect(formatValueForDisplay(304.8, 'ft')).toBe('1.000');
        });
    });

    describe('ft-in', () => {
        it('formats as architectural feet-inches', () => {
            expect(formatValueForDisplay(762, 'ft-in')).toBe('2\' 6"');
        });
    });
});

describe('parseDisplayUnitToMM', () => {
    describe('mm', () => {
        it('parses plain number', () => {
            expect(parseDisplayUnitToMM('500', 'mm')).toBe(500);
        });

        it('parses expression', () => {
            expect(parseDisplayUnitToMM('100 + 50', 'mm')).toBe(150);
        });
    });

    describe('cm', () => {
        it('converts cm to mm', () => {
            expect(parseDisplayUnitToMM('10', 'cm')).toBeCloseTo(100);
        });
    });

    describe('m', () => {
        it('converts m to mm', () => {
            expect(parseDisplayUnitToMM('1.5', 'm')).toBeCloseTo(1500);
        });
    });

    describe('in', () => {
        it('converts inches to mm', () => {
            expect(parseDisplayUnitToMM('1', 'in')).toBeCloseTo(25.4);
        });

        it('handles feet-inches input in inches mode', () => {
            // 2' 6" = 30 inches = 762 mm
            expect(parseDisplayUnitToMM('2\' 6"', 'in')).toBeCloseTo(762);
        });
    });

    describe('ft', () => {
        it('converts feet to mm', () => {
            expect(parseDisplayUnitToMM('1', 'ft')).toBeCloseTo(304.8);
        });

        it('parses expression', () => {
            expect(parseDisplayUnitToMM('1 + 0.5', 'ft')).toBeCloseTo(457.2);
        });
    });

    describe('ft-in', () => {
        it('parses feet-inches notation', () => {
            expect(parseDisplayUnitToMM('2\' 6"', 'ft-in')).toBeCloseTo(762);
        });

        it('parses plain number as inches', () => {
            expect(parseDisplayUnitToMM('12', 'ft-in')).toBeCloseTo(304.8);
        });
    });

    describe('round-trip accuracy', () => {
        const testCases: Array<{ unit: Parameters<typeof formatValueForDisplay>[1]; valueMM: number }> = [
            { unit: 'mm', valueMM: 1234 },
            { unit: 'cm', valueMM: 1234 },
            { unit: 'm', valueMM: 1234 },
            { unit: 'in', valueMM: 1234 },
            { unit: 'ft', valueMM: 1234 },
        ];

        testCases.forEach(({ unit, valueMM }) => {
            it(`round-trips through ${unit}`, () => {
                const displayed = formatValueForDisplay(valueMM, unit);
                const parsed = parseDisplayUnitToMM(displayed, unit);
                expect(parsed).toBeCloseTo(valueMM, 0);
            });
        });
    });

    describe('error handling', () => {
        it('returns NaN for empty string', () => {
            expect(parseDisplayUnitToMM('', 'mm')).toBeNaN();
        });

        it('returns NaN for invalid input', () => {
            expect(parseDisplayUnitToMM('abc', 'mm')).toBeNaN();
        });
    });
});
