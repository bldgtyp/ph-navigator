export type SIDisplayUnit = 'mm' | 'cm' | 'm';
export type IPDisplayUnit = 'in' | 'ft' | 'ft-in';
export type DisplayUnit = SIDisplayUnit | IPDisplayUnit;

export interface DimensionsContextType {
    units: string;
    editingColIndex: number | null;
    setEditingColIndex: (index: number | null) => void;
    editingRowIndex: number | null;
    setEditingRowIndex: (index: number | null) => void;
    editingValue: string;
    setEditingValue: (value: string) => void;
    handleEditColStart: (index: number, value: number) => void;
    handleEditColConfirm: (onColumnWidthChange: (index: number, value: number) => void) => void;
    handleEditRowStart: (index: number, value: number) => void;
    handleEditRowConfirm: (onRowHeightChange: (index: number, value: number) => void) => void;
}
