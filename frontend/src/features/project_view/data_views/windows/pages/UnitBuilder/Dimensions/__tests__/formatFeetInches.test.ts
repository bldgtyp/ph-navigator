import { formatFeetInches } from '../formatFeetInches';

describe('formatFeetInches', () => {
    it('formats zero', () => {
        expect(formatFeetInches(0)).toBe('0"');
    });

    it('formats exact feet', () => {
        expect(formatFeetInches(304.8)).toBe("1'");
        expect(formatFeetInches(609.6)).toBe("2'");
        expect(formatFeetInches(914.4)).toBe("3'");
    });

    it('formats exact inches', () => {
        expect(formatFeetInches(25.4)).toBe('1"');
        expect(formatFeetInches(152.4)).toBe('6"');
    });

    it('formats feet and inches', () => {
        expect(formatFeetInches(762.0)).toBe('2\' 6"');
        expect(formatFeetInches(1016.0)).toBe('3\' 4"');
    });

    it('formats inches with fractions', () => {
        // 6.5 inches = 165.1 mm
        expect(formatFeetInches(165.1)).toBe('6-1/2"');
    });

    it('formats feet, inches, and fractions', () => {
        // 2' 6-1/2" = 30.5 inches = 774.7 mm
        expect(formatFeetInches(774.7)).toBe('2\' 6-1/2"');
    });

    it('formats pure fractions', () => {
        // 1/2" = 12.7 mm
        expect(formatFeetInches(12.7)).toBe('1/2"');
        // 3/4" = 19.05 mm
        expect(formatFeetInches(19.05)).toBe('3/4"');
    });

    it('reduces fractions to lowest terms', () => {
        // 1/4" = 6.35 mm
        expect(formatFeetInches(6.35)).toBe('1/4"');
        // 1/2" = 12.7 mm — should not show as 8/16
        expect(formatFeetInches(12.7)).toBe('1/2"');
    });

    it('handles negative values', () => {
        expect(formatFeetInches(-304.8)).toBe("-1'");
    });

    it('snaps fractional inches to nearest 1/16', () => {
        // 1/16" = 1.5875 mm
        expect(formatFeetInches(1.5875)).toBe('1/16"');
    });
});
