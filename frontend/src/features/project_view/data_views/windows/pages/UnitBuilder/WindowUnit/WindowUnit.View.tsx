import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { useApertures } from '../../_contexts/ApertureContext';

import WindowUnitGrid from './WindowUnit.Grid';

const WindowUnitView: React.FC = () => {
    const { handleAddRow, handleAddColumn } = useApertures();

    return (
        <Box>
            <Box mb={2} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                <Button variant="contained" onClick={handleAddColumn}>
                    Add Column
                </Button>
                <Button variant="contained" onClick={handleAddRow}>
                    Add Row
                </Button>

                {/* <Tooltip title={selectedCells.length <= 1 ? 'Select multiple adjacent cells to merge' : ''}>
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
                )} */}
            </Box>

            <WindowUnitGrid />
        </Box>
    );
};

export default WindowUnitView;
