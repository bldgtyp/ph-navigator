import React, { useState } from 'react';
import { Box, Typography, TextField, ClickAwayListener, IconButton } from '@mui/material';
import RemoveCircleTwoToneIcon from '@mui/icons-material/RemoveCircleTwoTone';

import { DimensionLabelsProps, HorizontalDimensionLinesProps, VerticalDimensionLinesProps } from '../types';

// Calculate positions for grid lines and segment sizes
const calculateSegments = (sizes: number[]) => {
    const positions: number[] = [];
    const segments: number[] = [];
    let current = 0;

    // Start position
    positions.push(0);

    // Calculate positions and segments
    for (const size of sizes) {
        segments.push(size); // Store the actual size between points
        current += size;
        positions.push(current);
    }

    return { positions, segments };
};

const VerticalDimensionLines: React.FC<VerticalDimensionLinesProps> = ({ rowHeights, units, onRowHeightChange }) => {
    const labelSpacing = 10;
    const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    const { positions: rowPositions, segments: rowSegments } = calculateSegments(rowHeights);
    const totalHeight = rowPositions[rowPositions.length - 1];

    const handleEditStart = (index: number, value: number) => {
        setEditingRowIndex(index);
        setEditingValue(value.toString());
    };

    const handleEditConfirm = () => {
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
        <Box
            id="dimensions-left"
            sx={{
                position: 'absolute',
                top: 0,
                left: -labelSpacing * 5,
                height: '100%',
                width: labelSpacing * 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
            }}
        >
            {/* Grid line positions */}
            {rowPositions.map((position, index) => (
                <Box
                    key={`row-position-${index}`}
                    sx={{
                        position: 'absolute',
                        top: `${position}px`,
                        right: 0,
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        height: '20px',
                    }}
                >
                    <Box
                        sx={{
                            width: labelSpacing,
                            height: '1px',
                            bgcolor: 'grey.500',
                        }}
                    />
                </Box>
            ))}

            {/* Segment measurements (between grid lines) */}
            {rowSegments.map((height, index) => (
                <Box
                    key={`row-segment-${index}`}
                    sx={{
                        position: 'absolute',
                        top: `${rowPositions[index] + height / 2}px`,
                        right: labelSpacing + 5,
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        height: '20px',
                    }}
                >
                    {editingRowIndex === index ? (
                        <ClickAwayListener onClickAway={handleEditConfirm}>
                            <TextField
                                size="small"
                                autoFocus
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                                variant="outlined"
                                sx={{
                                    width: '80px',
                                    '& .MuiInputBase-input': {
                                        py: 0.5,
                                        px: 1,
                                        fontSize: '0.75rem',
                                        textAlign: 'right',
                                    },
                                }}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <Typography variant="caption" color="text.secondary">
                                                {units}
                                            </Typography>
                                        ),
                                    },
                                }}
                            />
                        </ClickAwayListener>
                    ) : (
                        <Typography
                            variant="caption"
                            sx={{
                                mr: 1,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 1,
                                    px: 0.5,
                                },
                            }}
                            onClick={() => handleEditStart(index, height)}
                        >
                            {height} {units}
                        </Typography>
                    )}
                </Box>
            ))}

            {/* Total height label */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    right: labelSpacing * 4.5,
                    transform: 'translateY(-50%) rotate(-90deg)',
                    transformOrigin: 'right center',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                    Total: {totalHeight} {units}
                </Typography>
            </Box>
        </Box>
    );
};

const HorizontalDimensionLines: React.FC<HorizontalDimensionLinesProps> = ({
    columnWidths,
    units,
    onColumnWidthChange,
    handleDeleteColumn,
}) => {
    const labelSpacing = 10;
    const [editingValue, setEditingValue] = useState<string>('');
    const [editingColIndex, setEditingColIndex] = useState<number | null>(null);

    const { positions: columnPositions, segments: columnSegments } = calculateSegments(columnWidths);
    const totalWidth = columnPositions[columnPositions.length - 1];

    const handleEditStart = (index: number, value: number) => {
        setEditingColIndex(index);
        setEditingValue(value.toString());
    };

    const handleEditConfirm = () => {
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

    return (
        <Box
            id="dimensions-bottom"
            sx={{
                position: 'absolute',
                left: 0,
                top: '100%',
                width: '100%',
                height: labelSpacing * 4,
                display: 'flex',
            }}
        >
            {/* Grid line positions */}
            {columnPositions.map((position, index) => (
                <Box
                    key={`col-position-${index}`}
                    sx={{
                        position: 'absolute',
                        left: `${position}px`,
                        top: 0,
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Box
                        sx={{
                            height: labelSpacing,
                            width: '1px',
                            bgcolor: 'grey.500',
                        }}
                    />
                </Box>
            ))}

            {/* Segment measurements (between grid lines) */}
            {columnSegments.map((width, index) => (
                <Box
                    className="col-segment-dimension"
                    key={`col-segment-${index}`}
                    sx={{
                        position: 'absolute',
                        left: `${columnPositions[index] + width / 2}px`,
                        top: labelSpacing + 5,
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <IconButton
                        className="delete-column-button"
                        onClick={e => {
                            handleDeleteColumn(index);
                        }}
                    >
                        <RemoveCircleTwoToneIcon fontSize="small" />
                    </IconButton>
                    {editingColIndex === index ? (
                        <ClickAwayListener onClickAway={handleEditConfirm}>
                            <TextField
                                size="small"
                                autoFocus
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEditConfirm()}
                                variant="outlined"
                                sx={{
                                    width: '80px',
                                    '& .MuiInputBase-input': {
                                        py: 0.5,
                                        px: 1,
                                        fontSize: '0.75rem',
                                        textAlign: 'center',
                                    },
                                }}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <Typography variant="caption" color="text.secondary">
                                                {units}
                                            </Typography>
                                        ),
                                    },
                                }}
                            />
                        </ClickAwayListener>
                    ) : (
                        <Typography
                            variant="caption"
                            sx={{
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: 'rgba(0,0,0,0.05)',
                                    borderRadius: 1,
                                    px: 0.5,
                                },
                            }}
                            onClick={() => handleEditStart(index, width)}
                        >
                            {width} {units}
                        </Typography>
                    )}
                </Box>
            ))}

            {/* Total width label */}
            <Box
                sx={{
                    position: 'absolute',
                    left: '50%',
                    bottom: -labelSpacing * 2,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    mt: 3,
                }}
            >
                <Typography variant="body2" fontWeight="bold">
                    Total: {totalWidth} {units}
                </Typography>
            </Box>
        </Box>
    );
};

const DimensionLabels: React.FC<DimensionLabelsProps> = ({
    rowHeights,
    columnWidths,
    units = 'mm',
    onColumnWidthChange,
    onRowHeightChange,
    handleDeleteColumn,
}) => {
    return (
        <>
            <VerticalDimensionLines rowHeights={rowHeights} units={units} onRowHeightChange={onRowHeightChange} />

            <HorizontalDimensionLines
                columnWidths={columnWidths}
                units={units}
                onColumnWidthChange={onColumnWidthChange}
                handleDeleteColumn={handleDeleteColumn}
            />
        </>
    );
};

export default DimensionLabels;
