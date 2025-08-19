import { createContext, useContext, useState } from 'react';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { DimensionsContextType } from './types';

const DimensionsContext = createContext<DimensionsContextType | undefined>(undefined);

export const DimensionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal, valueInSIUnits } = useUnitConversion();
    const units = unitSystem === 'SI' ? 'mm' : 'in';

    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    const handleEditColStart = (index: number, value: number) => {
        setEditingColIndex(index);
        // Convert the SI value to current unit system for editing
        const displayValue = valueInCurrentUnitSystemWithDecimal(value, 'mm', 'in', 2);
        setEditingValue(displayValue);
    };

    const handleEditColConfirm = (onColumnWidthChange: (index: number, value: number) => void) => {
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
    };

    const handleEditRowStart = (index: number, value: number) => {
        setEditingRowIndex(index);
        // Convert the SI value to current unit system for editing
        const displayValue = valueInCurrentUnitSystemWithDecimal(value, 'mm', 'in', 2);
        setEditingValue(displayValue);
    };

    const handleEditRowConfirm = (onRowHeightChange: (index: number, value: number) => void) => {
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
    };

    return (
        <DimensionsContext.Provider
            value={{
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
            }}
        >
            {children}
        </DimensionsContext.Provider>
    );
};

export const useDimensions = (): DimensionsContextType => {
    const context = useContext(DimensionsContext);
    if (!context) {
        throw new Error('useDimensions must be used within an DimensionsProvider');
    }
    return context;
};
