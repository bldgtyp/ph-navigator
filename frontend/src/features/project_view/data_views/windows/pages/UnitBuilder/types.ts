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
}

export interface HorizontalDimensionLinesProps {
    onColumnWidthChange: (index: number, value: number) => void;
    scaleFactor?: number;
}

export interface VerticalDimensionLinesProps {
    onRowHeightChange: (index: number, value: number) => void;
    scaleFactor?: number;
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

export interface ApertureFrameType {
    id: string;
    name: string;
    width_mm: number;
    u_value_w_m2k: number;
}

export interface ApertureElementFrame {
    id: number;
    name: string;
    frame_type: ApertureFrameType;
}

export interface ApertureElementFrames {
    top: ApertureElementFrame;
    right: ApertureElementFrame;
    bottom: ApertureElementFrame;
    left: ApertureElementFrame;
}

export interface ApertureGlazingType {
    id: number;
    name: string;
    u_value_w_m2k: number;
    g_value: number;
}

export interface ApertureElementGlazing {
    id: number;
    name: string;
    glazing_type: ApertureGlazingType;
}

export interface ApertureElementType {
    id: number;
    name: string;
    col_span: number;
    column_number: number;
    row_number: number;
    row_span: number;
    frames: ApertureElementFrames;
    glazing: ApertureElementGlazing;
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
