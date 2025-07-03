import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { useApertures } from './Aperture.Context';

import ApertureElements from './ApertureElements';

const ApertureView: React.FC = () => {
    const {
        handleAddRow,
        handleAddColumn,
        selectedApertureElementIds,
        mergeSelectedApertureElements,
        clearApertureElementIdSelection,
    } = useApertures();

    return (
        <Box className="aperture-view">
            <Box mb={2} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                <Button id="add-column-button" variant="contained" onClick={handleAddColumn}>
                    Add Column
                </Button>
                <Button id="add-row-button" variant="contained" onClick={handleAddRow}>
                    Add Row
                </Button>

                <Tooltip
                    title={selectedApertureElementIds.length <= 1 ? 'Select multiple adjacent cells to merge' : ''}
                >
                    <span>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={mergeSelectedApertureElements}
                            disabled={selectedApertureElementIds.length <= 1}
                        >
                            Merge Selected ({selectedApertureElementIds.length})
                        </Button>
                    </span>
                </Tooltip>

                {selectedApertureElementIds.length > 0 && (
                    <Button variant="outlined" onClick={clearApertureElementIdSelection}>
                        Clear Selection
                    </Button>
                )}
            </Box>

            <ApertureElements />
        </Box>
    );
};

export default ApertureView;
