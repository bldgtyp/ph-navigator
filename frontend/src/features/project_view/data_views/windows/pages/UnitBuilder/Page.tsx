import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import WindowGrid from './components/WindowGrid';
import { useWindowGrid } from './hooks/useWindowGrid';

const WindowUnitDisplay: React.FC = () => {
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

            <WindowGrid
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

const WindowUnits: React.FC = () => {
    return (
        <ContentBlock>
            <LoadingModal showModal={false} />
            <ContentBlockHeader text="Window & Door Builder" />
            <Box p={2}>
                <WindowUnitDisplay />
            </Box>
        </ContentBlock>
    );
};

export default WindowUnits;
