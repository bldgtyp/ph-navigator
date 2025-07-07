import React from 'react';
import { Box } from '@mui/material';
import { useApertures } from './Aperture.Context';
import { ApertureElementTableGroup } from './table/ApertureElementTableGroup';

const ApertureElementsTable: React.FC = () => {
    const { activeAperture, selectedApertureElementIds } = useApertures();

    if (!activeAperture) {
        return null;
    }

    return (
        <Box className="aperture-elements-table-container" sx={{ mt: 4 }}>
            {Array.from(activeAperture.elements.values()).map(element => (
                <ApertureElementTableGroup
                    key={element.id}
                    element={element}
                    isSelected={selectedApertureElementIds.includes(element.id)}
                />
            ))}
        </Box>
    );
};

export default ApertureElementsTable;
