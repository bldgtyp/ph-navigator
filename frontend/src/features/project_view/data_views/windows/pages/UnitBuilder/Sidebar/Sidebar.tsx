import { List, ListItem } from '@mui/material';

import { useApertures } from '../../_contexts/ApertureContext';

import ApertureListItemContent from './Sidebar.ListItemContent';
import ApertureListHeader from './Sidebar.ListHeader';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

const ApertureSidebar: React.FC = () => {
    const apertureContext = useApertures();

    // Create a sorted copy of the apertures array
    const sortedApertures = [...apertureContext.apertures].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <>
            <ChangeNameModal />
            <ApertureListHeader onAddAperture={apertureContext.handleAddAperture} />
            <List dense>
                {sortedApertures.map(aperture => (
                    <ListItem key={aperture.id} component="div" disablePadding>
                        <ApertureListItemContent
                            aperture={aperture}
                            isSelected={apertureContext.selectedApertureId === aperture.id}
                        />
                    </ListItem>
                ))}
            </List>
        </>
    );
};

export default ApertureSidebar;
