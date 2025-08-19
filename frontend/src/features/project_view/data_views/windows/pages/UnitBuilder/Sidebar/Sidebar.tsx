import { List, ListItem } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';

import ApertureListItemContent from './Sidebar.ListItemContent';
import ApertureListHeader from './Sidebar.ListHeader';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

const ApertureTypesSidebar: React.FC = () => {
    const { apertures, handleAddAperture, selectedApertureId } = useApertures();

    // Create a sorted copy of the apertures array
    const sortedApertures = [...apertures].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <>
            <ChangeNameModal />
            <ApertureListHeader onAddAperture={handleAddAperture} />
            <List dense>
                {sortedApertures.map(aperture => (
                    <ListItem key={aperture.id} component="div" disablePadding>
                        <ApertureListItemContent aperture={aperture} isSelected={selectedApertureId === aperture.id} />
                    </ListItem>
                ))}
            </List>
        </>
    );
};

export default ApertureTypesSidebar;
