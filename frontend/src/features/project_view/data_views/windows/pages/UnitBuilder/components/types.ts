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
