import React from 'react';
import { Box, Button } from '@mui/material';
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
    } = useWindowGrid();

    return (
        <Box>
            <Box mb={2}>
                <Button variant="contained" onClick={addColumn} sx={{ mr: 2 }}>
                    Add Column
                </Button>
                <Button variant="contained" onClick={addRow}>
                    Add Row
                </Button>
            </Box>

            <WindowGrid
                gridData={gridData}
                isPositionOccupied={isPositionOccupied}
                addSash={addSash}
                getCellSize={getCellSize}
                updateColumnWidth={updateColumnWidth}
                updateRowHeight={updateRowHeight}
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
