export interface SashData {
    id: string;
    type?: string;
    productRef?: string;
}

export interface GridCellData {
    id: string;
    sash?: SashData;
    rowSpan: number;
    colSpan: number;
    row: number;
    col: number;
}

export interface WindowGridData {
    rowHeights: number[];
    columnWidths: number[];
    cells: Map<string, GridCellData>;
}

export interface DimensionLabelsProps {
    rowHeights: number[];
    columnWidths: number[];
    labelSpacing?: number;
    units?: string;
    onColumnWidthChange: (index: number, value: number) => void;
    onRowHeightChange: (index: number, value: number) => void;
    handleDeleteColumn: (index: number) => void;
    handleDeleteRow: (index: number) => void;
}

export interface HorizontalDimensionLinesProps {
    columnWidths: number[];
    units: string;
    onColumnWidthChange: (index: number, value: number) => void;
    handleDeleteColumn: (index: number) => void;
}

export interface VerticalDimensionLinesProps {
    rowHeights: number[];
    units: string;
    onRowHeightChange: (index: number, value: number) => void;
    handleDeleteRow: (index: number) => void;
}
export interface GridCellProps {
    element: ApertureElementType;
    width: number;
    height: number;
}

export interface SashProps {
    height: number;
    width: number;
}

export interface GridLinesProps {
    rowHeights: number[];
    columnWidths: number[];
    isPositionOccupied: (row: number, col: number) => boolean;
    addSash: (row: number, col: number) => void;
}

export interface WindowGridProps {
    gridData: WindowGridData;
    isPositionOccupied: (row: number, col: number) => boolean;
    addSash: (row: number, col: number) => void;
    getCellSize: (row: number, col: number, rowSpan: number, colSpan: number) => { width: number; height: number };
    updateColumnWidth: (index: number, value: number) => void;
    updateRowHeight: (index: number, value: number) => void;
}

export interface ApertureElementType {
    id: number;
    col_span: number;
    column_number: number;
    row_number: number;
    row_span: number;
}

export interface ApertureType {
    id: number;
    name: string;
    column_widths_mm: number[];
    row_heights_mm: number[];
    elements: ApertureElementType[];
}

export const defaultAperture = {
    id: 0,
    name: 'default',
    column_widths_mm: [100],
    row_heights_mm: [100],
    elements: [
        {
            id: 0,
            col_span: 1,
            column_number: 1,
            row_number: 1,
            row_span: 1,
        },
    ],
};
