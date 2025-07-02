import React from 'react';
import { Box, Button } from '@mui/material';
import { GridLinesProps } from '../types';

const GridLines: React.FC<GridLinesProps> = ({ rowHeights, columnWidths, isPositionOccupied, addSash }) => {
    return (
        <Box
            className="window-grid-lines"
            sx={{
                display: 'grid',
                gridTemplateColumns: columnWidths.map(w => `${w}px`).join(' '),
                gridTemplateRows: rowHeights.map(h => `${h}px`).join(' '),
                gap: 0,
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 2,
                pointerEvents: 'none',
            }}
        >
            {rowHeights.map((_, rowIndex) =>
                columnWidths.map((_, colIndex) => {
                    // Only render grid lines for empty cells
                    if (isPositionOccupied(rowIndex, colIndex)) {
                        return null;
                    }

                    return (
                        <Box
                            className="window-gridline-cell"
                            key={`gridline-${rowIndex}-${colIndex}`}
                            sx={{
                                gridColumn: `${colIndex + 1}`,
                                gridRow: `${rowIndex + 1}`,
                                boxSizing: 'border-box',
                                border: '1px dashed lightgrey',
                                position: 'relative',
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                            }}
                        >
                            <Button
                                className="add-cell-button"
                                variant="outlined"
                                size="small"
                                sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: 3,
                                    pointerEvents: 'auto',
                                }}
                                onClick={e => {
                                    e.stopPropagation();
                                    addSash(rowIndex, colIndex);
                                }}
                            >
                                +
                            </Button>
                        </Box>
                    );
                })
            )}
        </Box>
    );
};

export default GridLines;
