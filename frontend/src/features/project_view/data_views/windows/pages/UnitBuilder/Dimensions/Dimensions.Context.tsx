import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { DimensionsContextType } from './types';

const DimensionsContext = createContext<DimensionsContextType | undefined>(undefined);

export const DimensionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal, valueInSIUnits } = useUnitConversion();
    const units = unitSystem === 'SI' ? 'mm' : 'in';

    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    const handleEditColStart = useCallback(
        (index: number, value: number) => {
            setEditingColIndex(index);
            // Convert the SI value to current unit system for editing
            const displayValue = valueInCurrentUnitSystemWithDecimal(value, 'mm', 'in', 2);
            setEditingValue(displayValue);
        },
        [valueInCurrentUnitSystemWithDecimal]
    );

    const handleEditColConfirm = useCallback(
        (onColumnWidthChange: (index: number, value: number) => void) => {
            const value = parseFloat(editingValue);

            if (!isNaN(value) && value > 0) {
                if (editingColIndex !== null) {
                    // Convert the entered value back to SI units (mm) for storage
                    const siValue = valueInSIUnits(value, 'mm', 'in');
                    onColumnWidthChange(editingColIndex, siValue);
                    setEditingColIndex(null);
                }
            }

            // Reset the editing state regardless of whether the value was valid
            setEditingColIndex(null);
        },
        [editingColIndex, editingValue, valueInSIUnits]
    );

    const handleEditRowStart = useCallback(
        (index: number, value: number) => {
            setEditingRowIndex(index);
            // Convert the SI value to current unit system for editing
            const displayValue = valueInCurrentUnitSystemWithDecimal(value, 'mm', 'in', 2);
            setEditingValue(displayValue);
        },
        [valueInCurrentUnitSystemWithDecimal]
    );

    const handleEditRowConfirm = useCallback(
        (onRowHeightChange: (index: number, value: number) => void) => {
            const value = parseFloat(editingValue);

            if (!isNaN(value) && value > 0) {
                if (editingRowIndex !== null) {
                    // Convert the entered value back to SI units (mm) for storage
                    const siValue = valueInSIUnits(value, 'mm', 'in');
                    onRowHeightChange(editingRowIndex, siValue);
                    setEditingRowIndex(null);
                }
            }

            // Reset the editing state regardless of whether the value was valid
            setEditingRowIndex(null);
        },
        [editingRowIndex, editingValue, valueInSIUnits]
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
