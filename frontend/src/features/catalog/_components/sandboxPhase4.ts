export type SingleSelectOption = {
    id: string;
    name: string;
    color: string;
};

export const SINGLE_SELECT_COLOR_PALETTE = [
    '#d8f5dc',
    '#fde3cf',
    '#d7ecff',
    '#f8d9ea',
    '#f4efc3',
    '#e2dbff',
    '#d5f3f0',
    '#ffd8d8',
    '#e6e0d4',
    '#d7f0d4',
    '#ffe6b8',
    '#cde7ff',
    '#edd8ff',
    '#d6efe7',
];

const normalizeDisplayName = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const normalizeSingleSelectMatchKey = (value: string): string => normalizeDisplayName(value).toLowerCase();

export const getSingleSelectNextColor = (optionCount: number): string =>
    SINGLE_SELECT_COLOR_PALETTE[optionCount % SINGLE_SELECT_COLOR_PALETTE.length];

export const getSingleSelectTextColor = (background: string): '#1f2937' | '#ffffff' => {
    const hex = background.replace('#', '');
    if (hex.length !== 6) return '#1f2937';
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 150 ? '#1f2937' : '#ffffff';
};

const makeOptionId = (name: string, options: SingleSelectOption[]): string => {
    const base =
        normalizeSingleSelectMatchKey(name)
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'option';
    const used = new Set(options.map(option => option.id));
    if (!used.has(base)) return base;
    let suffix = 2;
    while (used.has(`${base}-${suffix}`)) {
        suffix += 1;
    }
    return `${base}-${suffix}`;
};

export const findSingleSelectOptionById = (
    options: SingleSelectOption[],
    value: unknown
): SingleSelectOption | undefined => {
    if (value == null || value === '') return undefined;
    const id = String(value);
    return options.find(option => option.id === id);
};

export const findSingleSelectOptionByName = (
    options: SingleSelectOption[],
    value: string
): SingleSelectOption | undefined => {
    const key = normalizeSingleSelectMatchKey(value);
    if (!key) return undefined;
    return options.find(option => normalizeSingleSelectMatchKey(option.name) === key);
};

export const getSingleSelectOptionLabel = (options: SingleSelectOption[], value: unknown): string => {
    const byId = findSingleSelectOptionById(options, value);
    if (byId) return byId.name;
    if (typeof value === 'string') {
        const byName = findSingleSelectOptionByName(options, value);
        return byName?.name ?? normalizeDisplayName(value);
    }
    return value == null ? '' : String(value);
};

export const matchOrCreateSingleSelectOption = ({
    options,
    rawValue,
}: {
    options: SingleSelectOption[];
    rawValue: string;
}): {
    createdOption?: SingleSelectOption;
    options: SingleSelectOption[];
    value: string | null;
} => {
    const name = normalizeDisplayName(rawValue);
    if (!name) {
        return { options, value: null };
    }
    const existing = findSingleSelectOptionByName(options, name);
    if (existing) {
        return { options, value: existing.id };
    }
    const createdOption: SingleSelectOption = {
        id: makeOptionId(name, options),
        name,
        color: getSingleSelectNextColor(options.length),
    };
    return {
        createdOption,
        options: [...options, createdOption],
        value: createdOption.id,
    };
};

export const seedSingleSelectValues = (
    rawValues: Array<string | null | undefined>
): { options: SingleSelectOption[]; values: Array<string | null> } => {
    let options: SingleSelectOption[] = [];
    const values = rawValues.map(rawValue => {
        const result = matchOrCreateSingleSelectOption({ options, rawValue: rawValue ?? '' });
        options = result.options;
        return result.value;
    });
    return { options, values };
};

export const compareSingleSelectValues = (left: unknown, right: unknown, options: SingleSelectOption[]): number => {
    const order = new Map(options.map((option, index) => [option.id, index]));
    const leftId = left == null ? null : String(left);
    const rightId = right == null ? null : String(right);
    const leftOrder = leftId == null ? undefined : order.get(leftId);
    const rightOrder = rightId == null ? undefined : order.get(rightId);
    if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
    if (leftOrder != null) return -1;
    if (rightOrder != null) return 1;
    return getSingleSelectOptionLabel(options, left).localeCompare(getSingleSelectOptionLabel(options, right));
};
