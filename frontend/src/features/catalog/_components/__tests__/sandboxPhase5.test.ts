import {
    FilterCondition,
    computeAggregation,
    deriveTintRoles,
    evaluateConditions,
    getColumnTint,
    groupConditionsByColumn,
} from '../sandboxPhase5';

const makeCondition = (overrides: Partial<FilterCondition> = {}): FilterCondition => ({
    id: 'c1',
    colId: 'name',
    columnType: 'text',
    operator: 'contains',
    value: '',
    selected: [],
    ...overrides,
});

describe('sandboxPhase5 — evaluateConditions', () => {
    it('passes when no conditions are configured', () => {
        expect(evaluateConditions([], 'anything')).toBe(true);
    });

    it('text contains is case-insensitive', () => {
        expect(evaluateConditions([makeCondition({ operator: 'contains', value: 'IN' })], 'Insulation')).toBe(true);
        expect(evaluateConditions([makeCondition({ operator: 'contains', value: 'xyz' })], 'Insulation')).toBe(false);
    });

    it('text does_not_contain inverts contains', () => {
        expect(evaluateConditions([makeCondition({ operator: 'does_not_contain', value: 'foo' })], 'bar')).toBe(true);
        expect(evaluateConditions([makeCondition({ operator: 'does_not_contain', value: 'bar' })], 'bar')).toBe(false);
    });

    it('handles is_empty / is_not_empty', () => {
        expect(evaluateConditions([makeCondition({ operator: 'is_empty' })], null)).toBe(true);
        expect(evaluateConditions([makeCondition({ operator: 'is_empty' })], '')).toBe(true);
        expect(evaluateConditions([makeCondition({ operator: 'is_empty' })], 'x')).toBe(false);
        expect(evaluateConditions([makeCondition({ operator: 'is_not_empty' })], 'x')).toBe(true);
        expect(evaluateConditions([makeCondition({ operator: 'is_not_empty' })], null)).toBe(false);
    });

    it('numeric eq / gt / lt / between', () => {
        const c = (overrides: Partial<FilterCondition>) =>
            makeCondition({ colId: 'density_kg_m3', columnType: 'number', ...overrides });
        expect(evaluateConditions([c({ operator: 'eq', value: 100 })], 100)).toBe(true);
        expect(evaluateConditions([c({ operator: 'eq', value: 100 })], 50)).toBe(false);
        expect(evaluateConditions([c({ operator: 'gt', value: 100 })], 200)).toBe(true);
        expect(evaluateConditions([c({ operator: 'lt', value: 100 })], 50)).toBe(true);
        expect(evaluateConditions([c({ operator: 'between', value: 50, valueB: 200 })], 100)).toBe(true);
        expect(evaluateConditions([c({ operator: 'between', value: 50, valueB: 200 })], 10)).toBe(false);
        expect(evaluateConditions([c({ operator: 'gt', value: 100 })], null)).toBe(false);
    });

    it('single_select is_any_of / is_none_of', () => {
        const cond = makeCondition({
            colId: 'category',
            columnType: 'single_select',
            operator: 'is_any_of',
            selected: ['insulation', 'concrete'],
        });
        expect(evaluateConditions([cond], 'insulation')).toBe(true);
        expect(evaluateConditions([cond], 'metal')).toBe(false);
        expect(evaluateConditions([{ ...cond, operator: 'is_none_of' }], 'metal')).toBe(true);
        expect(evaluateConditions([{ ...cond, operator: 'is_none_of' }], 'insulation')).toBe(false);
    });

    it('stacks conditions with AND semantics', () => {
        const conditions: FilterCondition[] = [
            makeCondition({ id: 'a', operator: 'contains', value: 'in' }),
            makeCondition({ id: 'b', operator: 'does_not_contain', value: 'metal' }),
        ];
        expect(evaluateConditions(conditions, 'Insulation')).toBe(true);
        expect(evaluateConditions(conditions, 'metal-insulation')).toBe(false);
    });

    it('skips conditions that are not yet configured', () => {
        // operator needs a value but value is empty → condition is dormant
        const cond = makeCondition({ operator: 'contains', value: '' });
        expect(evaluateConditions([cond], 'anything')).toBe(true);
    });
});

describe('sandboxPhase5 — groupConditionsByColumn', () => {
    it('groups conditions by colId preserving order', () => {
        const grouped = groupConditionsByColumn([
            makeCondition({ id: '1', colId: 'name', value: 'a' }),
            makeCondition({ id: '2', colId: 'category', columnType: 'single_select', operator: 'is_any_of' }),
            makeCondition({ id: '3', colId: 'name', value: 'b' }),
        ]);
        expect(grouped.name).toHaveLength(2);
        expect(grouped.category).toHaveLength(1);
        expect(grouped.name.map(c => c.id)).toEqual(['1', '3']);
    });
});

describe('sandboxPhase5 — deriveTintRoles + getColumnTint', () => {
    it('assigns roles per column', () => {
        const roles = deriveTintRoles({
            filterColumns: ['a', 'b'],
            sortColumns: ['b'],
            groupColumns: ['c'],
        });
        expect(roles.a.has('filter')).toBe(true);
        expect(roles.b.has('filter')).toBe(true);
        expect(roles.b.has('sort')).toBe(true);
        expect(roles.c.has('group')).toBe(true);
    });

    it('returns null when column has no role', () => {
        const roles = deriveTintRoles({ filterColumns: [], sortColumns: [], groupColumns: [] });
        expect(getColumnTint(roles, 'a', 'body')).toBeNull();
    });

    it('returns layered tints for combinations', () => {
        const roles = deriveTintRoles({
            filterColumns: ['x'],
            sortColumns: ['x'],
            groupColumns: ['x'],
        });
        const body = getColumnTint(roles, 'x', 'body');
        const header = getColumnTint(roles, 'x', 'header');
        expect(body).not.toBeNull();
        expect(header).not.toBeNull();
        expect(body).not.toBe(header); // header variant is darker
    });
});

describe('sandboxPhase5 — computeAggregation', () => {
    it('returns count regardless of value type', () => {
        expect(computeAggregation('count', [1, null, 'a'])).toBe('3');
    });

    it('computes sum / mean / min / max over numeric values, ignoring non-numeric', () => {
        const values = [10, 20, 30, null, 'oops'];
        expect(computeAggregation('sum', values)).toBe('60');
        expect(computeAggregation('mean', values)).toBe('20');
        expect(computeAggregation('min', values)).toBe('10');
        expect(computeAggregation('max', values)).toBe('30');
    });

    it('returns em-dash placeholder when no numeric values are present', () => {
        expect(computeAggregation('mean', [null, 'oops'])).toBe('—');
    });

    it('returns empty string for none', () => {
        expect(computeAggregation('none', [1, 2])).toBe('');
    });
});
