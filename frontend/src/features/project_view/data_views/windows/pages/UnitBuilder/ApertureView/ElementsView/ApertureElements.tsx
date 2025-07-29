import { Box, Stack } from '@mui/material';

import { useApertures } from '../Aperture.Context';
import { DimensionsProvider } from '../../Dimensions/Dimensions.Context';

import ApertureElementContainer from './ApertureElement.Container';
import ElementLabelsOverlay from './ElementLabelsOverlay';
import VerticalDimensionLines from '../../Dimensions/Dimensions.Vertical';
import HorizontalDimensionLines from '../../Dimensions/Dimensions.Horizontal';

const ApertureElementsDisplay: React.FC = () => {
    const { activeAperture, getCellSize, selectedApertureElementIds } = useApertures();

    if (!activeAperture) {
        return <Box sx={{ p: 2 }}>No aperture selected</Box>;
    }

    return (
        <Box
            className="aperture-elements-display"
            sx={{
                display: 'grid',
                gridTemplateColumns: activeAperture.column_widths_mm.map(w => `${w}px`).join(' '),
                gridTemplateRows: activeAperture.row_heights_mm.map(h => `${h}px`).join(' '),
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
                return (
                    <ApertureElementContainer
                        key={element.id}
                        element={element}
                        width={width}
                        height={height}
                        isSelected={selectedApertureElementIds.includes(element.id)}
                    />
                );
            })}
        </Box>
    );
};

const ApertureElements: React.FC = () => {
    const { activeAperture, updateColumnWidth, updateRowHeight } = useApertures();

    if (!activeAperture) {
        return <Box sx={{ p: 2 }}>No aperture selected</Box>;
    }

    // Calculate total grid dimensions for the container
    const totalWidth = activeAperture.column_widths_mm.reduce((sum, width) => sum + width, 0);
    const totalHeight = activeAperture.row_heights_mm.reduce((sum, height) => sum + height, 0);

    return (
        <Stack
            className="aperture-elements-container"
            spacing={2}
            sx={{
                position: 'relative',
                pl: 12,
                pb: 6,
                pt: 1,
                pr: 1,
                mt: 4,
            }}
        >
            <Box
                className="aperture-elements-display-container"
                sx={{
                    position: 'relative',
                    width: `${totalWidth}px`,
                    height: `${totalHeight}px`,
                    border: '1px solid #ccc',
                }}
            >
                <ApertureElementsDisplay />
                <ElementLabelsOverlay />
                <DimensionsProvider>
                    <VerticalDimensionLines
                        onRowHeightChange={(index, value) => updateRowHeight(activeAperture.id, index, value)}
                    />
                    <HorizontalDimensionLines
                        onColumnWidthChange={(index, value) => updateColumnWidth(activeAperture.id, index, value)}
                    />
                </DimensionsProvider>
            </Box>
        </Stack>
    );
};

export default ApertureElements;
