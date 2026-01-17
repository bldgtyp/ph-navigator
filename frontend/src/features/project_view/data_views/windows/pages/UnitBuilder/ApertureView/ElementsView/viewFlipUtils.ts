export const getColumnOrder = (columnCount: number, isInsideView: boolean): number[] => {
    const indices = Array.from({ length: columnCount }, (_, i) => i);
    return isInsideView ? indices.reverse() : indices;
};

export const getDisplayColumnIndex = (
    originalIndex: number,
    colSpan: number,
    columnCount: number,
    isInsideView: boolean
): number => {
    if (!isInsideView) {
        return originalIndex;
    }

    return columnCount - 1 - originalIndex - (colSpan - 1);
};

export const getDisplayColumnWidths = (columnWidths: number[], isInsideView: boolean): number[] => {
    return isInsideView ? [...columnWidths].reverse() : columnWidths;
};
