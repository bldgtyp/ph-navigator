import { evaluateSimpleExpression } from '../evaluateExpression';

describe('evaluateSimpleExpression', () => {
    describe('simple numbers', () => {
        it('parses simple integer', () => {
            expect(evaluateSimpleExpression('100')).toBe(100);
        });

        it('parses decimal number', () => {
            expect(evaluateSimpleExpression('12.5')).toBe(12.5);
        });

        it('parses negative number', () => {
            expect(evaluateSimpleExpression('-50')).toBe(-50);
        });

        it('parses number with leading zeros', () => {
            expect(evaluateSimpleExpression('007')).toBe(7);
        });
    });

    describe('basic arithmetic', () => {
        it('evaluates addition', () => {
            expect(evaluateSimpleExpression('100 + 150')).toBe(250);
        });

        it('evaluates subtraction', () => {
            expect(evaluateSimpleExpression('200 - 50')).toBe(150);
        });

        it('evaluates multiplication', () => {
            expect(evaluateSimpleExpression('10 * 5')).toBe(50);
        });

        it('evaluates division', () => {
            expect(evaluateSimpleExpression('100 / 4')).toBe(25);
        });

        it('evaluates decimal arithmetic', () => {
            expect(evaluateSimpleExpression('10.5 + 2.5')).toBe(13);
        });
    });

    describe('chained operations', () => {
        it('evaluates chained addition', () => {
            expect(evaluateSimpleExpression('1 + 2 + 3')).toBe(6);
        });

        it('evaluates chained subtraction', () => {
            expect(evaluateSimpleExpression('100 - 20 - 30')).toBe(50);
        });

        it('evaluates chained multiplication', () => {
            expect(evaluateSimpleExpression('2 * 3 * 4')).toBe(24);
        });

        it('evaluates chained division', () => {
            expect(evaluateSimpleExpression('100 / 2 / 5')).toBe(10);
        });

        it('handles many chained operations', () => {
            expect(evaluateSimpleExpression('1 + 2 + 3 + 4 + 5')).toBe(15);
        });
    });

    describe('operator precedence', () => {
        it('multiplication before addition', () => {
            expect(evaluateSimpleExpression('2 + 3 * 4')).toBe(14);
        });

        it('division before subtraction', () => {
            expect(evaluateSimpleExpression('10 - 6 / 2')).toBe(7);
        });

        it('multiplication before subtraction', () => {
            expect(evaluateSimpleExpression('10 - 2 * 3')).toBe(4);
        });

        it('division before addition', () => {
            expect(evaluateSimpleExpression('5 + 10 / 2')).toBe(10);
        });

        it('handles complex mixed precedence', () => {
            // 2 + 3 * 4 - 6 / 2 = 2 + 12 - 3 = 11
            expect(evaluateSimpleExpression('2 + 3 * 4 - 6 / 2')).toBe(11);
        });
    });

    describe('whitespace handling', () => {
        it('handles no spaces', () => {
            expect(evaluateSimpleExpression('100+50')).toBe(150);
        });

        it('handles extra spaces', () => {
            expect(evaluateSimpleExpression('  100   +   50  ')).toBe(150);
        });

        it('handles mixed spacing', () => {
            expect(evaluateSimpleExpression('10+ 20 +30')).toBe(60);
        });
    });

    describe('edge cases', () => {
        it('returns NaN for division by zero', () => {
            expect(evaluateSimpleExpression('100 / 0')).toBeNaN();
        });

        it('returns NaN for empty string', () => {
            expect(evaluateSimpleExpression('')).toBeNaN();
        });

        it('returns NaN for whitespace only', () => {
            expect(evaluateSimpleExpression('   ')).toBeNaN();
        });

        it('returns NaN for incomplete expression (trailing operator)', () => {
            expect(evaluateSimpleExpression('100 +')).toBeNaN();
        });

        it('returns NaN for incomplete expression (leading operator)', () => {
            expect(evaluateSimpleExpression('+ 100')).toBeNaN();
        });

        it('returns NaN for double operators', () => {
            expect(evaluateSimpleExpression('100 + + 50')).toBeNaN();
        });
    });

    describe('security - invalid input rejection', () => {
        it('returns NaN for alphabetic input', () => {
            expect(evaluateSimpleExpression('abc')).toBeNaN();
        });

        it('returns NaN for code injection attempt with alert', () => {
            expect(evaluateSimpleExpression('alert(1)')).toBeNaN();
        });

        it('returns NaN for code injection attempt with function', () => {
            expect(evaluateSimpleExpression('function(){}')).toBeNaN();
        });

        it('returns NaN for code injection with eval', () => {
            expect(evaluateSimpleExpression('eval("1+1")')).toBeNaN();
        });

        it('returns NaN for variable references', () => {
            expect(evaluateSimpleExpression('x + 1')).toBeNaN();
        });

        it('returns NaN for parentheses (not supported)', () => {
            expect(evaluateSimpleExpression('(1 + 2) * 3')).toBeNaN();
        });

        it('returns NaN for special characters', () => {
            expect(evaluateSimpleExpression('100 $ 50')).toBeNaN();
        });

        it('returns NaN for semicolons', () => {
            expect(evaluateSimpleExpression('100; 50')).toBeNaN();
        });
    });
});
