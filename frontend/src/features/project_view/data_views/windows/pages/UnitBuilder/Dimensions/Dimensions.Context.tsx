import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useDisplayUnit } from './DisplayUnit.Context';
import { DimensionsContextType } from './types';

const DimensionsContext = createContext<DimensionsContextType | undefined>(undefined);

export const DimensionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { displayUnitLabel, formatValue, parseToMM } = useDisplayUnit();
    const units = displayUnitLabel;

    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    // Track the initial display string so no-op edits don't overwrite with a rounded value
    const initialEditValue = useRef<string>('');

    const handleEditColStart = useCallback(
        (index: number, value: number) => {
            setEditingColIndex(index);
            const display = formatValue(value);
            initialEditValue.current = display;
            setEditingValue(display);
        },
        [formatValue]
    );

    const handleEditColConfirm = useCallback(
        (onColumnWidthChange: (index: number, value: number) => void) => {
            if (editingColIndex !== null && editingValue !== initialEditValue.current) {
                const valueMM = parseToMM(editingValue);
                if (!isNaN(valueMM) && valueMM > 0) {
                    onColumnWidthChange(editingColIndex, valueMM);
                }
            }

            setEditingColIndex(null);
        },
        [editingColIndex, editingValue, parseToMM]
    );

    const handleEditRowStart = useCallback(
        (index: number, value: number) => {
            setEditingRowIndex(index);
            const display = formatValue(value);
            initialEditValue.current = display;
            setEditingValue(display);
        },
        [formatValue]
    );

    const handleEditRowConfirm = useCallback(
        (onRowHeightChange: (index: number, value: number) => void) => {
            if (editingRowIndex !== null && editingValue !== initialEditValue.current) {
                const valueMM = parseToMM(editingValue);
                if (!isNaN(valueMM) && valueMM > 0) {
                    onRowHeightChange(editingRowIndex, valueMM);
                }
            }

            setEditingRowIndex(null);
        },
        [editingRowIndex, editingValue, parseToMM]
    );

    const value = useMemo(
        () => ({
            units,
            editingColIndex,
            setEditingColIndex,
            editingRowIndex,
            setEditingRowIndex,
            editingValue,
            setEditingValue,
            handleEditColStart,
            handleEditColConfirm,
            handleEditRowStart,
            handleEditRowConfirm,
        }),
        [
            units,
            editingColIndex,
            editingRowIndex,
            editingValue,
            handleEditColStart,
            handleEditColConfirm,
            handleEditRowStart,
            handleEditRowConfirm,
        ]
    );

    return <DimensionsContext.Provider value={value}>{children}</DimensionsContext.Provider>;
};

export const useDimensions = (): DimensionsContextType => {
    const context = useContext(DimensionsContext);
    if (!context) {
        throw new Error('useDimensions must be used within an DimensionsProvider');
    }
    return context;
};
