import { useContext } from 'react';
import { Box } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useDimensions } from './Dimensions.Context';
import { useViewDirection } from '../ApertureView/ViewDirection.Context';
import { getColumnOrder } from '../ApertureView/ElementsView/viewFlipUtils';

import { calculateSegments } from './calcSegments';
import GridLineTick from './GridLineTick';
import DeleteButton from './DeleteButton';
import { DimensionLabel, DimensionEditable } from './Dimension.Label';
import { HorizontalDimensionLinesProps } from '../types';

const HorizontalDimensionLines: React.FC<HorizontalDimensionLinesProps> = ({
    onColumnWidthChange,
    scaleFactor = 1,
}) => {
    const labelWidth = 40;
    const gridlineTickGap = 5;

    const userContext = useContext(UserContext);
    const { units, editingColIndex, handleEditColStart, handleEditColConfirm } = useDimensions();
    const { activeAperture, handleDeleteColumn } = useApertures();
    const { isInsideView } = useViewDirection();

    if (!activeAperture) {
        return null;
    }

    const columnOrder = getColumnOrder(activeAperture.column_widths_mm.length, isInsideView);
    const displayWidths = columnOrder.map(index => activeAperture.column_widths_mm[index] * scaleFactor);
    const { positions: columnPositions, segments: columnSegments } = calculateSegments(displayWidths);
    const totalWidth = columnPositions[columnPositions.length - 1];

    return (
        <Box
            id="dimensions-bottom"
            sx={{
                position: 'absolute',
                left: 0,
                top: `calc(100% + ${gridlineTickGap}px)`,
                width: '100%',
                height: labelWidth,
                display: 'flex',
            }}
        >
            {/* Grid line positions */}
            {columnPositions.map((location, index) => (
                <GridLineTick key={`col-gridline-tick-${index}`} orientation="horizontal" location={location} />
            ))}

            {/* Segment measurements (between grid lines) */}
            {columnSegments.map((width, displayIndex) => {
                const actualIndex = columnOrder[displayIndex];
                return (
                    <Box
                        className="col-segment-dimension"
                        key={`col-segment-${actualIndex}`}
                        sx={{
                            position: 'absolute',
                            left: `${columnPositions[displayIndex] + width / 2}px`,
                            top: 10,
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        {editingColIndex === actualIndex && userContext.user ? (
                            <DimensionEditable handleEditConfirm={() => handleEditColConfirm(onColumnWidthChange)} />
                        ) : (
                            <DimensionLabel
                                handleEditStart={handleEditColStart}
                                index={actualIndex}
                                value={activeAperture.column_widths_mm[actualIndex]}
                                orientation="horizontal"
                            />
                        )}
                        <DeleteButton index={actualIndex} handleDelete={handleDeleteColumn} />
                    </Box>
                );
            })}

            {/* Total width label */}
            {/* <Box
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
            </Box> */}
        </Box>
    );
};

export default HorizontalDimensionLines;
