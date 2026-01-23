import { useMemo } from 'react';
import { Box } from '@mui/material';
import { Flipper, Flipped } from 'react-flip-toolkit';

import { useApertures } from '../../../_contexts/Aperture.Context';
import { ElementUValueResult } from '../types';

import { ApertureElementTableGroup } from './ElementTableGroup';

interface ApertureElementsTableProps {
    elementUValues: Map<number, ElementUValueResult>;
    uValueLoading: boolean;
}

const ApertureElementsTable: React.FC<ApertureElementsTableProps> = ({ elementUValues, uValueLoading }) => {
    const { activeAperture, selectedApertureElementIds } = useApertures();

    // Sort elements: selected first (alphabetically), then non-selected (alphabetically)
    const sortedElements = useMemo(() => {
        if (!activeAperture) return [];

        return Array.from(activeAperture.elements.values()).sort((a, b) => {
            const nameA = a.name || `Element ${a.id}`;
            const nameB = b.name || `Element ${b.id}`;

            const aSelected = selectedApertureElementIds.includes(a.id);
            const bSelected = selectedApertureElementIds.includes(b.id);

            // Both selected or both not selected: sort alphabetically
            if (aSelected === bSelected) {
                return nameA.localeCompare(nameB);
            }

            // Selected elements come first
            return aSelected ? -1 : 1;
        });
    }, [activeAperture, selectedApertureElementIds]);

    // Generate a key that changes when the order changes (triggers FLIP animation)
    const flipKey = sortedElements.map(e => e.id).join(',');

    if (!activeAperture) {
        return null;
    }

    return (
        <Flipper flipKey={flipKey} spring={{ stiffness: 200, damping: 25 }}>
            <Box className="aperture-elements-table-container" sx={{ mt: 4 }}>
                {sortedElements.map(element => (
                    <Flipped key={element.id} flipId={`element-${element.id}`}>
                        <div>
                            <ApertureElementTableGroup
                                aperture={activeAperture}
                                element={element}
                                isSelected={selectedApertureElementIds.includes(element.id)}
                                elementUValue={elementUValues.get(element.id)}
                                uValueLoading={uValueLoading}
                            />
                        </div>
                    </Flipped>
                ))}
            </Box>
        </Flipper>
    );
};

export default ApertureElementsTable;
