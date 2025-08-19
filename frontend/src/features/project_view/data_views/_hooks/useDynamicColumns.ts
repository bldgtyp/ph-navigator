import { useMemo } from 'react';
import { GridColDef } from '@mui/x-data-grid';

function getMaxContentLengthForColumn(rowData: any[], columnField: string): number {
    // Calculate the max content length for a specific column
    return Math.max(
        ...rowData.map(item => {
            const value = item[columnField];
            if (Array.isArray(value)) {
                return Math.max(...value.map(v => (typeof v === 'string' ? v.length : String(v).length)));
            }
            return typeof value === 'string' ? value.length : String(value).length;
        }),
        0 // Default to 0 if no data
    );
}

export const useDynamicColumns = (initialColumns: GridColDef[], rowData: any[], columnsToResize: string[]) => {
    return useMemo(() => {
        if (!rowData || rowData.length === 0) return initialColumns;

        // Clone columns (shallow) so we don't mutate caller's array/objects
        const updatedColumns: GridColDef[] = initialColumns.map(col => ({ ...col }));

        const CHAR_PX = 8; // average monospace-ish char width heuristic
        const H_PADDING = 24; // extra padding for cell & sort icon space

        columnsToResize.forEach(field => {
            const idx = updatedColumns.findIndex(c => c.field === field);
            if (idx === -1) return;

            const col = updatedColumns[idx];
            const contentLen = getMaxContentLengthForColumn(rowData, field);
            const headerLen = typeof col.headerName === 'string' ? col.headerName.length : 0;

            const logicalLen = Math.max(contentLen, headerLen);
            const newMinWidth = Math.max(25, logicalLen * CHAR_PX + H_PADDING);

            if (col.minWidth !== newMinWidth) {
                col.minWidth = newMinWidth;
            }
        });

        return updatedColumns;
    }, [initialColumns, rowData, columnsToResize]);
};
