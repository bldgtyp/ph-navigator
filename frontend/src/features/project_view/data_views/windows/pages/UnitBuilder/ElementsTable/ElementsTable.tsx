import { Box } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';

import { ApertureElementTableGroup } from './ElementTableGroup';

const ApertureElementsTable: React.FC = () => {
    const { activeAperture, selectedApertureElementIds } = useApertures();

    if (!activeAperture) {
        return null;
    }

    return (
        <Box className="aperture-elements-table-container" sx={{ mt: 4 }}>
            {Array.from(activeAperture.elements.values())
                .sort((a, b) => {
                    const nameA = a.name || `Element ${a.id}`;
                    const nameB = b.name || `Element ${b.id}`;
                    return nameA.localeCompare(nameB);
                })
                .map(element => (
                    <ApertureElementTableGroup
                        key={element.id}
                        aperture={activeAperture}
                        element={element}
                        isSelected={selectedApertureElementIds.includes(element.id)}
                    />
                ))}
        </Box>
    );
};

export default ApertureElementsTable;
