import React from 'react';
import { Box } from '@mui/material';

import { useApertures } from '../../_contexts/ApertureContext';

import GridCell from './GridCell';
import DimensionLabels from './DimensionLabels';
import { useWindowGrid } from '../hooks/useWindowGrid';

const WindowUnitGrid: React.FC = () => {
    const { getCellSize, updateColumnWidth, updateRowHeight } = useWindowGrid();
    const { activeAperture, handleDeleteColumn, handleDeleteRow } = useApertures();

    if (!activeAperture) {
        return <Box sx={{ p: 2 }}>No aperture selected</Box>;
    }

    // Calculate total grid dimensions for the container
    const totalWidth = activeAperture.column_widths_mm.reduce((sum, width) => sum + width, 0);
    const totalHeight = activeAperture.row_heights_mm.reduce((sum, height) => sum + height, 0);

    return (
        <Box
            className="window-grid-outer-container"
            sx={{
                position: 'relative',
                pl: 6,
                pb: 6,
                pt: 1,
                pr: 1,
                mt: 4,
            }}
        >
            <Box
                className="window-cells-container"
                sx={{
                    position: 'relative',
                    width: `${totalWidth}px`,
                    height: `${totalHeight}px`,
                    border: '1px solid #ccc',
                }}
            >
                {/* Main grid with cells */}
                <Box
                    className="window-cells"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: activeAperture.column_widths_mm.map(w => `${w}px`).join(' '),
                        gridTemplateRows: activeAperture.row_heights_mm.map(h => `${h}px`).join(' '),
                        gap: 0,
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {Array.from(activeAperture.elements.values()).map(element => {
                        const { width, height } = getCellSize(
                            element.row_number,
                            element.column_number,
                            element.row_span,
                            element.col_span
                        );
                        return (
                            <GridCell
                                key={element.id}
                                element={element}
                                width={width}
                                height={height}
                                // isSelected={selectedCells.includes(element.id)}
                                // onToggleSelect={toggleCellSelection}
                            />
                        );
                    })}
                </Box>

                <DimensionLabels
                    rowHeights={activeAperture.row_heights_mm}
                    columnWidths={activeAperture.column_widths_mm}
                    onColumnWidthChange={updateColumnWidth}
                    onRowHeightChange={updateRowHeight}
                    handleDeleteColumn={handleDeleteColumn}
                    handleDeleteRow={handleDeleteRow}
                />
            </Box>
        </Box>
    );
};

export default WindowUnitGrid;
