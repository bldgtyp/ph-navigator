import {
    SINGLE_SELECT_COLOR_PALETTE,
    compareSingleSelectValues,
    getSingleSelectOptionLabel,
    getSingleSelectTextColor,
    matchOrCreateSingleSelectOption,
    seedSingleSelectValues,
} from '../sandboxPhase4';

describe('sandboxPhase4 helpers', () => {
    it('picks dark or light pill text based on color luminance', () => {
        expect(getSingleSelectTextColor('#d8f5dc')).toBe('#1f2937');
        expect(getSingleSelectTextColor('#123456')).toBe('#ffffff');
    });

    it('matches single-select names case-insensitively and trims whitespace', () => {
        const seeded = seedSingleSelectValues(['Insulation', 'Concrete']);
        const result = matchOrCreateSingleSelectOption({
            options: seeded.options,
            rawValue: '  insulation  ',
        });
        expect(result.value).toBe(seeded.values[0]);
        expect(result.createdOption).toBeUndefined();
        expect(result.options).toHaveLength(2);
    });

    it('creates new options with the next palette color and reuses them on later writes', () => {
        const seeded = seedSingleSelectValues(['Insulation']);
        const firstCreate = matchOrCreateSingleSelectOption({
            options: seeded.options,
            rawValue: 'Mineral Wool',
        });
        expect(firstCreate.createdOption?.name).toBe('Mineral Wool');
        expect(firstCreate.createdOption?.color).toBe(SINGLE_SELECT_COLOR_PALETTE[1]);

        const secondWrite = matchOrCreateSingleSelectOption({
            options: firstCreate.options,
            rawValue: 'mineral wool',
        });
        expect(secondWrite.value).toBe(firstCreate.createdOption?.id);
        expect(secondWrite.createdOption).toBeUndefined();
        expect(secondWrite.options).toHaveLength(2);
    });

    it('seeds category values into option ids and preserves labels for display', () => {
        const seeded = seedSingleSelectValues(['Insulation', 'Concrete', 'INSULATION', '']);
        expect(seeded.options.map(option => option.name)).toEqual(['Insulation', 'Concrete']);
        expect(seeded.values[0]).toBe(seeded.values[2]);
        expect(seeded.values[3]).toBeNull();
        expect(getSingleSelectOptionLabel(seeded.options, seeded.values[1])).toBe('Concrete');
    });

    it('sorts by option order instead of alphabetical label', () => {
        const seeded = seedSingleSelectValues(['Zeta', 'Alpha']);
        expect(compareSingleSelectValues(seeded.values[1], seeded.values[0], seeded.options)).toBeGreaterThan(0);
        expect(getSingleSelectOptionLabel(seeded.options, seeded.values[0])).toBe('Zeta');
        expect(getSingleSelectOptionLabel(seeded.options, seeded.values[1])).toBe('Alpha');
    });
});
