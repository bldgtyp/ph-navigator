import { createContext, useContext, useState } from 'react';

interface DimensionsContextType {
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

const DimensionsContext = createContext<DimensionsContextType | undefined>(undefined);

export const DimensionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const units = 'mm';
    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    const handleEditColStart = (index: number, value: number) => {
        setEditingColIndex(index);
        setEditingValue(value.toString());
    };

    const handleEditColConfirm = (onColumnWidthChange: (index: number, value: number) => void) => {
        const value = parseInt(editingValue, 10);

        if (!isNaN(value) && value > 0) {
            if (editingColIndex !== null) {
                onColumnWidthChange(editingColIndex, value);
                setEditingColIndex(null);
            }
        }

        // Reset the editing state regardless of whether the value was valid
        setEditingColIndex(null);
    };

    const handleEditRowStart = (index: number, value: number) => {
        setEditingRowIndex(index);
        setEditingValue(value.toString());
    };

    const handleEditRowConfirm = (onRowHeightChange: (index: number, value: number) => void) => {
        const value = parseInt(editingValue, 10);

        if (!isNaN(value) && value > 0) {
            if (editingRowIndex !== null) {
                onRowHeightChange(editingRowIndex, value);
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
