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
    psi_g_w_mk: number;
    manufacturer: string | null;
    brand: string | null;
    use: string | null;
    operation: string | null;
    location: string | null;
    mull_type: string | null;
    source: string | null;
    datasheet_url: string | null;
    link: string | null;
    comments: string | null;
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
    id: string;
    name: string;
    u_value_w_m2k: number;
    g_value: number;
    manufacturer: string | null;
    brand: string | null;
    source: string | null;
    datasheet_url: string | null;
    link: string | null;
    comments: string | null;
}

export interface ApertureElementGlazing {
    id: number;
    name: string;
    glazing_type: ApertureGlazingType;
}

export type OperationType = 'swing' | 'slide';
export type OperationDirection = 'left' | 'right' | 'up' | 'down';

export type InsertPosition = 'start' | 'end';
export type GridEdge = 'top' | 'bottom' | 'left' | 'right';

export interface ElementOperation {
    type: OperationType;
    directions: OperationDirection[];
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
    operation: ElementOperation | null;
}

export interface ApertureType {
    id: number;
    name: string;
    column_widths_mm: number[];
    row_heights_mm: number[];
    elements: ApertureElementType[];
}

export interface ElementAssignmentsPayload {
    operation: ElementOperation | null;
    glazingTypeId: string;
    frameTypeIds: {
        top: string;
        right: string;
        bottom: string;
        left: string;
    };
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

export interface ManufacturerFilterConfig {
    available_frame_manufacturers: string[];
    enabled_frame_manufacturers: string[];
    available_glazing_manufacturers: string[];
    enabled_glazing_manufacturers: string[];
    used_frame_manufacturers: string[];
    used_glazing_manufacturers: string[];
}

/**
 * Per-element U-value result from the API.
 */
export interface ElementUValueResult {
    element_id: number;
    u_value_w_m2k: number;
    total_area_m2: number;
    glazing_area_m2: number;
    frame_area_m2: number;
}

/**
 * Response from the window U-value calculation API.
 * Calculated per ISO 10077-1:2006.
 */
export interface WindowUValueResponse {
    u_value_w_m2k: number;
    total_area_m2: number;
    glazing_area_m2: number;
    frame_area_m2: number;
    heat_loss_glazing_w_k: number;
    heat_loss_frame_w_k: number;
    heat_loss_spacer_w_k: number;
    is_valid: boolean;
    warnings: string[];
    calculation_method: string;
    includes_psi_install: boolean;
    element_u_values: ElementUValueResult[];
}
