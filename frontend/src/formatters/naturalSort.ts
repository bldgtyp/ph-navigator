/** Natural sort comparator: treats embedded numbers by value so "C2" < "C10". */
export const naturalSortCompare = (a: string, b: string): number =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
