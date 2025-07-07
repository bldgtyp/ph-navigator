import React from 'react';
import { Box } from '@mui/material';
import { useApertures } from './Aperture.Context';
import { ApertureElementTableGroup } from './table/ApertureElementTableGroup';
import { ApertureElementFrameType } from '../types';

const ApertureElementsTable: React.FC = () => {
    const { activeAperture, selectedApertureElementIds } = useApertures();

    if (!activeAperture) {
        return null;
    }

    const handleFrameChange = (
        elementId: number,
        framePosition: 'top' | 'right' | 'bottom' | 'left',
        frame: ApertureElementFrameType | null
    ) => {
        // TODO: Implement API call to update the frame
        console.log(`Updating element ${elementId}, ${framePosition} frame to:`, frame);

        // For now, just log the change. You'll need to implement the actual API call here
        // Example API call structure:
        // updateElementFrame(elementId, framePosition, frame?.id || null);
    };

    return (
        <Box className="aperture-elements-table-container" sx={{ mt: 4 }}>
            {Array.from(activeAperture.elements.values()).map(element => (
                <ApertureElementTableGroup
                    key={element.id}
                    element={element}
                    isSelected={selectedApertureElementIds.includes(element.id)}
                    onFrameChange={(framePosition, frame) => handleFrameChange(element.id, framePosition, frame)}
                />
            ))}
        </Box>
    );
};

export default ApertureElementsTable;
