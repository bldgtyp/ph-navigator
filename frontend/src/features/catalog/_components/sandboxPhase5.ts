// Phase 5 — stacked sort / filter / group + toolbar tinting.
// Pure helpers; UI lives in SandboxTanStack.tsx. See
// docs/plans/2026-05-06/airtable-parity-phases.md §8.

export type FilterColumnType = 'text' | 'number' | 'single_select';

export type FilterOperator =
    | 'contains'
    | 'does_not_contain'
    | 'is'
    | 'is_not'
    | 'is_empty'
    | 'is_not_empty'
    | 'eq'
    | 'neq'
    | 'gt'
    | 'lt'
    | 'between'
    | 'is_any_of'
    | 'is_none_of';

export type FilterCondition = {
    id: string;
    colId: string;
    columnType: FilterColumnType;
    operator: FilterOperator;
    value: string | number | null;
    valueB?: number | null;
    selected?: string[];
};

export type SortRule = { id: string; colId: string; desc: boolean };
export type GroupRule = { id: string; colId: string; desc: boolean };

export type AggregationKind = 'none' | 'count' | 'sum' | 'mean' | 'min' | 'max';

export const TEXT_OPERATORS: FilterOperator[] = [
    'contains',
    'does_not_contain',
    'is',
    'is_not',
    'is_empty',
    'is_not_empty',
];

export const NUMBER_OPERATORS: FilterOperator[] = ['eq', 'neq', 'gt', 'lt', 'between', 'is_empty', 'is_not_empty'];

export const SINGLE_SELECT_OPERATORS: FilterOperator[] = ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'];

export const OPERATORS_BY_TYPE: Record<FilterColumnType, FilterOperator[]> = {
    text: TEXT_OPERATORS,
    number: NUMBER_OPERATORS,
    single_select: SINGLE_SELECT_OPERATORS,
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
    contains: 'contains',
    does_not_contain: 'does not contain',
    is: 'is',
    is_not: 'is not',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
    eq: '=',
    neq: '≠',
    gt: '>',
    lt: '<',
    between: 'between',
    is_any_of: 'is any of',
    is_none_of: 'is none of',
};

export const AGGREGATION_LABELS: Record<AggregationKind, string> = {
    none: 'none',
    count: 'count',
    sum: 'sum',
    mean: 'mean',
    min: 'min',
    max: 'max',
};

export const operatorNeedsValue = (operator: FilterOperator): boolean =>
    operator !== 'is_empty' && operator !== 'is_not_empty';

const operatorRequiresSelection = (operator: FilterOperator): boolean =>
    operator === 'is_any_of' || operator === 'is_none_of';

const isConditionConfigured = (condition: FilterCondition): boolean => {
    if (!operatorNeedsValue(condition.operator)) return true;
    if (operatorRequiresSelection(condition.operator)) return (condition.selected?.length ?? 0) > 0;
    if (condition.columnType === 'number') {
        if (condition.operator === 'between') {
            return condition.value != null && condition.valueB != null;
        }
        return condition.value != null && !Number.isNaN(Number(condition.value));
    }
    return condition.value != null && String(condition.value).length > 0;
};

export const evaluateConditions = (conditions: FilterCondition[], value: unknown): boolean => {
    for (const condition of conditions) {
        if (!isConditionConfigured(condition)) continue;
        const isEmpty = value == null || value === '';
        switch (condition.operator) {
            case 'is_empty':
                if (!isEmpty) return false;
                break;
            case 'is_not_empty':
                if (isEmpty) return false;
                break;
            case 'contains': {
                const haystack = String(value ?? '').toLowerCase();
                if (!haystack.includes(String(condition.value ?? '').toLowerCase())) return false;
                break;
            }
            case 'does_not_contain': {
                const haystack = String(value ?? '').toLowerCase();
                if (haystack.includes(String(condition.value ?? '').toLowerCase())) return false;
                break;
            }
            case 'is':
                if (String(value ?? '') !== String(condition.value ?? '')) return false;
                break;
            case 'is_not':
                if (String(value ?? '') === String(condition.value ?? '')) return false;
                break;
            case 'eq':
                if (isEmpty || Number(value) !== Number(condition.value)) return false;
                break;
            case 'neq':
                if (!isEmpty && Number(value) === Number(condition.value)) return false;
                break;
            case 'gt':
                if (isEmpty || !(Number(value) > Number(condition.value))) return false;
                break;
            case 'lt':
                if (isEmpty || !(Number(value) < Number(condition.value))) return false;
                break;
            case 'between': {
                if (isEmpty) return false;
                const numeric = Number(value);
                const a = Number(condition.value);
                const b = Number(condition.valueB);
                const lo = Math.min(a, b);
                const hi = Math.max(a, b);
                if (numeric < lo || numeric > hi) return false;
                break;
            }
            case 'is_any_of':
                if (isEmpty || !(condition.selected ?? []).includes(String(value))) return false;
                break;
            case 'is_none_of':
                if (!isEmpty && (condition.selected ?? []).includes(String(value))) return false;
                break;
        }
    }
    return true;
};

export const groupConditionsByColumn = (conditions: FilterCondition[]): Record<string, FilterCondition[]> => {
    const grouped: Record<string, FilterCondition[]> = {};
    conditions.forEach(condition => {
        if (!grouped[condition.colId]) grouped[condition.colId] = [];
        grouped[condition.colId].push(condition);
    });
    return grouped;
};

export type TintRole = 'filter' | 'sort' | 'group';
export type TintRoles = Record<string, Set<TintRole>>;

export const deriveTintRoles = ({
    filterColumns,
    sortColumns,
    groupColumns,
}: {
    filterColumns: string[];
    sortColumns: string[];
    groupColumns: string[];
}): TintRoles => {
    const roles: TintRoles = {};
    const ensure = (colId: string): Set<TintRole> => {
        if (!roles[colId]) roles[colId] = new Set();
        return roles[colId];
    };
    filterColumns.forEach(id => ensure(id).add('filter'));
    sortColumns.forEach(id => ensure(id).add('sort'));
    groupColumns.forEach(id => ensure(id).add('group'));
    return roles;
};

// Pre-mixed background tints for the seven non-empty role combinations.
// Light wash for body cells; the header variants (below) are slightly darker.
export const ROLE_BACKGROUNDS = {
    body: {
        filter: '#ecfbef',
        sort: '#fff1e0',
        group: '#f1ebfa',
        filter_sort: '#f5f6e4',
        filter_group: '#eef3f3',
        sort_group: '#f5e9ea',
        filter_sort_group: '#efeeec',
    },
    header: {
        filter: '#dcf5e3',
        sort: '#fde4cf',
        group: '#e8e0f5',
        filter_sort: '#ecedd0',
        filter_group: '#e1ebec',
        sort_group: '#ecdcd9',
        filter_sort_group: '#e3e0dc',
    },
} as const;

export const TOOLBAR_TINTS = {
    filter: { active: '#dcf5e3', label: '#15803d' },
    sort: { active: '#fde4cf', label: '#c2410c' },
    group: { active: '#e8e0f5', label: '#6d28d9' },
} as const;

const roleKey = (set: Set<TintRole>): keyof typeof ROLE_BACKGROUNDS.body | null => {
    const has = (role: TintRole) => set.has(role);
    const f = has('filter');
    const s = has('sort');
    const g = has('group');
    if (f && s && g) return 'filter_sort_group';
    if (f && s) return 'filter_sort';
    if (f && g) return 'filter_group';
    if (s && g) return 'sort_group';
    if (f) return 'filter';
    if (s) return 'sort';
    if (g) return 'group';
    return null;
};

export const getColumnTint = (roles: TintRoles, colId: string, variant: 'body' | 'header'): string | null => {
    const set = roles[colId];
    if (!set || set.size === 0) return null;
    const key = roleKey(set);
    return key ? ROLE_BACKGROUNDS[variant][key] : null;
};

export const computeAggregation = (kind: AggregationKind, values: unknown[]): string => {
    if (kind === 'none') return '';
    if (kind === 'count') return String(values.length);
    const numeric = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (numeric.length === 0) return '—';
    if (kind === 'sum') return numeric.reduce((acc, v) => acc + v, 0).toLocaleString();
    if (kind === 'mean') {
        const sum = numeric.reduce((acc, v) => acc + v, 0);
        return (sum / numeric.length).toLocaleString(undefined, { maximumFractionDigits: 3 });
    }
    if (kind === 'min') return Math.min(...numeric).toLocaleString();
    if (kind === 'max') return Math.max(...numeric).toLocaleString();
    return '';
};

export const newConditionId = (): string => `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultOperatorForType = (type: FilterColumnType): FilterOperator => {
    if (type === 'number') return 'eq';
    if (type === 'single_select') return 'is_any_of';
    return 'contains';
};
