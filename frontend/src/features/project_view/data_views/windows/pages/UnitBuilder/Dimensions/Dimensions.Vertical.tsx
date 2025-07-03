import React, { useState } from 'react';
import { Box, Typography, TextField, ClickAwayListener, IconButton } from '@mui/material';
import RemoveCircleTwoToneIcon from '@mui/icons-material/RemoveCircleTwoTone';

import { VerticalDimensionLinesProps } from '../types';
import { useApertures } from '../ApertureView/Aperture.Context';
import { calculateSegments } from './calcSegments';

const VerticalDimensionLines: React.FC<VerticalDimensionLinesProps> = ({ rowHeights, units, onRowHeightChange }) => {
    const labelSpacing = 10;
    const { handleDeleteRow } = useApertures();
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
                    className="row-segment-dimension"
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
                    <IconButton
                        className="delete-row-button"
                        onClick={e => {
                            handleDeleteRow(index);
                        }}
                    >
                        <RemoveCircleTwoToneIcon fontSize="small" />
                    </IconButton>
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
                                        onFocus: event => {
                                            event.target.select();
                                        },
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

export default VerticalDimensionLines;
