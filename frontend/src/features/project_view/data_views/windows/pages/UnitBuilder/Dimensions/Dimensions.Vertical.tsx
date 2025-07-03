import React, { useContext, useState } from 'react';
import { Box } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useApertures } from '../ApertureView/Aperture.Context';
import { useDimensions } from './Dimensions.Context';

import { VerticalDimensionLinesProps } from '../types';
import { calculateSegments } from './calcSegments';
import DeleteButton from './DeleteButton';
import GridLineTick from './GridLineTick';
import { DimensionEditable, DimensionLabel } from './Dimension.Label';

const VerticalDimensionLines: React.FC<VerticalDimensionLinesProps> = ({ onRowHeightChange }) => {
    const labelWidth = 40;
    const gridlineTickGap = 5;

    const userContext = useContext(UserContext);
    const { units, editingRowIndex, handleEditRowStart, handleEditRowConfirm } = useDimensions();
    const { activeAperture, handleDeleteRow } = useApertures();

    if (!activeAperture) {
        return null;
    }

    const { positions: rowPositions, segments: rowSegments } = calculateSegments(activeAperture.row_heights_mm);
    const totalHeight = rowPositions[rowPositions.length - 1];

    return (
        <Box
            id="dimensions-left"
            sx={{
                position: 'absolute',
                top: 0,
                left: -labelWidth - gridlineTickGap,
                height: '100%',
                width: labelWidth,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
            }}
        >
            {/* Grid line Ticks */}
            {rowPositions.map((location, index) => (
                <GridLineTick key={`row-gridline-tick-${index}`} orientation="vertical" location={location} />
            ))}

            {/* Segment measurements (between grid lines) */}
            {rowSegments.map((height, index) => (
                <Box
                    className="row-segment-dimension-label"
                    key={`row-segment-${index}`}
                    sx={{
                        position: 'absolute',
                        top: `${rowPositions[index] + height / 2}px`,
                        right: 0,
                        transform: 'translateY(-50%)', // Center text vertically
                        display: 'flex',
                        alignItems: 'center',
                        height: '20px',
                    }}
                >
                    <DeleteButton index={index} handleDelete={handleDeleteRow} />

                    {editingRowIndex === index && userContext.user ? (
                        <DimensionEditable handleEditConfirm={() => handleEditRowConfirm(onRowHeightChange)} />
                    ) : (
                        <DimensionLabel
                            handleEditStart={handleEditRowStart}
                            index={index}
                            value={height}
                            orientation="vertical"
                        />
                    )}
                </Box>
            ))}

            {/* Total height label */}
            {/* <Box
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
            </Box> */}
        </Box>
    );
};

export default VerticalDimensionLines;
