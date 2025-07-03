import React, { useState } from 'react';
import { Box, Typography, TextField, ClickAwayListener, IconButton } from '@mui/material';
import RemoveCircleTwoToneIcon from '@mui/icons-material/RemoveCircleTwoTone';

import { HorizontalDimensionLinesProps } from '../types';
import { useApertures } from '../ApertureView/Aperture.Context';
import { calculateSegments } from './calcSegments';

const HorizontalDimensionLines: React.FC<HorizontalDimensionLinesProps> = ({
    columnWidths,
    units,
    onColumnWidthChange,
}) => {
    const labelSpacing = 10;
    const { handleDeleteColumn } = useApertures();
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

export default HorizontalDimensionLines;
