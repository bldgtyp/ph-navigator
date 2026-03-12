import { Box, List, ListItem } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';

import ApertureListItemContent from './Sidebar.ListItemContent';
import ApertureListHeader from './Sidebar.ListHeader';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

/** Natural sort comparator: treats embedded numbers by value so "C2" < "C10". */
export const naturalSortCompare = (a: string, b: string): number =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const ApertureTypesSidebar: React.FC = () => {
    const { apertures, handleAddAperture, selectedApertureId } = useApertures();

    // Create a sorted copy of the apertures array
    const sortedApertures = [...apertures].sort((a, b) => naturalSortCompare(a.name, b.name));

    return (
        <>
            <ChangeNameModal />
            <ApertureListHeader onAddAperture={handleAddAperture} />
            <Box
                sx={{
                    maxHeight: 'calc(100vh - 360px)',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}
            >
                <List dense>
                    {sortedApertures.map(aperture => (
                        <ListItem key={aperture.id} component="div" disablePadding>
                            <ApertureListItemContent
                                aperture={aperture}
                                isSelected={selectedApertureId === aperture.id}
                            />
                        </ListItem>
                    ))}
                </List>
            </Box>
        </>
    );
};

export default ApertureTypesSidebar;
