import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { useApertures } from './Aperture.Context';

import ApertureElements from './ApertureElements';

const ApertureView: React.FC = () => {
    const { handleAddRow, handleAddColumn } = useApertures();

    return (
        <Box className="aperture-view">
            <Box mb={2} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                <Button id="add-column-button" variant="contained" onClick={handleAddColumn}>
                    Add Column
                </Button>
                <Button id="add-row-button" variant="contained" onClick={handleAddRow}>
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

            <ApertureElements />
        </Box>
    );
};

export default ApertureView;
