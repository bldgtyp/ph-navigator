import { Box, Stack } from '@mui/material';

import { useApertures } from '../../../../_contexts/Aperture.Context';
import { useZoom } from '../Zoom.Context';
import { useViewDirection } from '../ViewDirection.Context';
import { DimensionsProvider } from '../../Dimensions/Dimensions.Context';
import ApertureToolbar from '../ApertureToolbar';
import { getDisplayColumnIndex, getDisplayColumnWidths } from './viewFlipUtils';

import ApertureElementContainer from './ApertureElement.Container';
import EdgeAddButtons from './EdgeAddButtons';
import ElementLabelsOverlay from './ElementLabelsOverlay';
import VerticalDimensionLines from '../../Dimensions/Dimensions.Vertical';
import HorizontalDimensionLines from '../../Dimensions/Dimensions.Horizontal';

const ApertureElementsDisplay: React.FC = () => {
    const { activeAperture, getCellSize, selectedApertureElementIds } = useApertures();
    const { scaleFactor } = useZoom();
    const { isInsideView } = useViewDirection();

    if (!activeAperture) {
        return <Box sx={{ p: 2 }}>No aperture selected</Box>;
    }

    return (
        <Box
            className="aperture-elements-display"
            sx={{
                display: 'grid',
                gridTemplateColumns: getDisplayColumnWidths(activeAperture.column_widths_mm, isInsideView)
                    .map(w => `${w * scaleFactor}px`)
                    .join(' '),
                gridTemplateRows: activeAperture.row_heights_mm.map(h => `${h * scaleFactor}px`).join(' '),
                gap: 0,
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
            }}
        >
            {Array.from(activeAperture.elements.values()).map(element => {
                const { width, height } = getCellSize(
                    element.row_number,
                    element.column_number,
                    element.row_span,
                    element.col_span
                );
                const displayColumnIndex = getDisplayColumnIndex(
                    element.column_number,
                    element.col_span,
                    activeAperture.column_widths_mm.length,
                    isInsideView
                );
                return (
                    <ApertureElementContainer
                        key={element.id}
                        element={element}
                        width={width * scaleFactor}
                        height={height * scaleFactor}
                        isSelected={selectedApertureElementIds.includes(element.id)}
                        gridColumnStart={displayColumnIndex + 1}
                        gridColumnEnd={displayColumnIndex + 1 + element.col_span}
                    />
                );
            })}
        </Box>
    );
};

const ApertureElements: React.FC = () => {
    const { activeAperture, updateColumnWidth, updateRowHeight } = useApertures();
    const { scaleFactor } = useZoom();

    if (!activeAperture) {
        return <Box sx={{ p: 2 }}>No aperture selected</Box>;
    }

    // Calculate total grid dimensions for the container (with scaling applied)
    const totalWidthMM = activeAperture.column_widths_mm.reduce((sum, width) => sum + width, 0);
    const totalHeightMM = activeAperture.row_heights_mm.reduce((sum, height) => sum + height, 0);
    const scaledWidth = totalWidthMM * scaleFactor;
    const scaledHeight = totalHeightMM * scaleFactor;

    return (
        <Stack
            className="aperture-elements-container"
            spacing={4}
            sx={{
                position: 'relative',
                pl: 12,
                pb: 8,
                pt: 0.0,
                pr: 1,
                mt: 0.0,
            }}
        >
            <ApertureToolbar />
            <Box
                className="aperture-elements-display-container"
                sx={{
                    position: 'relative',
                    width: `${scaledWidth}px`,
                    height: `${scaledHeight}px`,
                    border: '1px solid #ccc',
                    // overflow: 'hidden', // Clip content that exceeds container bounds
                }}
            >
                <EdgeAddButtons />
                <ApertureElementsDisplay />
                <ElementLabelsOverlay />
                <DimensionsProvider>
                    <VerticalDimensionLines
                        onRowHeightChange={(index, value) => updateRowHeight(activeAperture.id, index, value)}
                        scaleFactor={scaleFactor}
                    />
                    <HorizontalDimensionLines
                        onColumnWidthChange={(index, value) => updateColumnWidth(activeAperture.id, index, value)}
                        scaleFactor={scaleFactor}
                    />
                </DimensionsProvider>
            </Box>
        </Stack>
    );
};

export default ApertureElements;
