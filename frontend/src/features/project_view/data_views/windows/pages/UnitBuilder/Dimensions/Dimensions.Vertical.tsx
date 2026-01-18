import { useContext } from 'react';
import { Box } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { useDimensions } from './Dimensions.Context';

import { calculateSegments } from './calcSegments';
import { DIMENSION_LABEL_WIDTH_PX, EXTRA_DIMENSION_GUTTER_PX, GRIDLINE_TICK_GAP_PX } from './constants';
import DeleteButton from './DeleteButton';
import GridLineTick from './GridLineTick';
import { DimensionEditable, DimensionLabel } from './Dimension.Label';
import DimensionCenterGuide from './DimensionCenterGuide';
import { VerticalDimensionLinesProps } from '../types';

const VerticalDimensionLines: React.FC<VerticalDimensionLinesProps> = ({ onRowHeightChange, scaleFactor = 1 }) => {
    const labelWidth = DIMENSION_LABEL_WIDTH_PX;
    const gridlineTickGap = GRIDLINE_TICK_GAP_PX;
    const dimensionGutter = gridlineTickGap + EXTRA_DIMENSION_GUTTER_PX;

    const userContext = useContext(UserContext);
    const { units, editingRowIndex, handleEditRowStart, handleEditRowConfirm } = useDimensions();
    const { activeAperture, handleDeleteRow } = useApertures();

    if (!activeAperture) {
        return null;
    }

    const { positions: rowPositions, segments: rowSegments } = calculateSegments(
        activeAperture.row_heights_mm.map(h => h * scaleFactor)
    );
    const totalHeight = rowPositions[rowPositions.length - 1];

    return (
        <Box
            id="dimensions-left"
            sx={{
                position: 'absolute',
                top: 0,
                left: -labelWidth - dimensionGutter,
                height: `${totalHeight}px`,
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
            <DimensionCenterGuide orientation="vertical" positions={rowPositions} length={totalHeight} />

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
                        zIndex: 1,
                    }}
                >
                    <DeleteButton index={index} handleDelete={handleDeleteRow} />

                    {editingRowIndex === index && userContext.user ? (
                        <DimensionEditable handleEditConfirm={() => handleEditRowConfirm(onRowHeightChange)} />
                    ) : (
                        <DimensionLabel
                            handleEditStart={handleEditRowStart}
                            index={index}
                            value={activeAperture.row_heights_mm[index]}
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
