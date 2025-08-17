import { useState, useEffect } from 'react';
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
    const [columnsState, setColumnsState] = useState(initialColumns);

    useEffect(() => {
        if (rowData.length > 0) {
            // Create a copy of the initial columns
            const updatedColumns = [...initialColumns];

            // Update the minWidth for each column in columnsToResize
            columnsToResize.forEach(columnToResize => {
                const maxContentLength = getMaxContentLengthForColumn(rowData, columnToResize);
                const columnIndex = updatedColumns.findIndex(col => col.field === columnToResize);

                if (columnIndex !== -1) {
                    updatedColumns[columnIndex].minWidth = Math.max(25, maxContentLength * 10); // Adjust multiplier as needed
                }
            });

            // Update state once after processing all columns
            setColumnsState(updatedColumns);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rowData]);

    return columnsState;
};
