import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { useApertures } from '../../_contexts/ApertureContext';
import { useWindowGrid } from '../hooks/useWindowGrid';

import WindowUnitGrid from './WindowUnit.Grid';

const WindowUnitView: React.FC = () => {
    const {
        gridData,
        isPositionOccupied,
        addRow,
        addColumn,
        addSash,
        getCellSize,
        updateColumnWidth,
        updateRowHeight,
        selectedCells,
        toggleCellSelection,
        clearSelection,
        mergeSelectedCells,
    } = useWindowGrid();

    const { selectedAperture, apertures } = useApertures();
    console.log('WindowUnitView > apertures=', apertures);

    return (
        <Box>
            <Box mb={2} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                <Button variant="contained" onClick={addColumn}>
                    Add Column
                </Button>
                <Button variant="contained" onClick={addRow}>
                    Add Row
                </Button>

                <Tooltip title={selectedCells.length <= 1 ? 'Select multiple adjacent cells to merge' : ''}>
                    <span>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={mergeSelectedCells}
                            disabled={selectedCells.length <= 1}
                        >
                            Merge Selected ({selectedCells.length})
                        </Button>
                    </span>
                </Tooltip>

                {selectedCells.length > 0 && (
                    <Button variant="outlined" onClick={clearSelection}>
                        Clear Selection
                    </Button>
                )}
            </Box>

            <WindowUnitGrid
                selectedAperture={selectedAperture}
                gridData={gridData}
                isPositionOccupied={isPositionOccupied}
                addSash={addSash}
                getCellSize={getCellSize}
                updateColumnWidth={updateColumnWidth}
                updateRowHeight={updateRowHeight}
                selectedCells={selectedCells}
                toggleCellSelection={toggleCellSelection}
            />
        </Box>
    );
};

export default WindowUnitView;
