import { useContext } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { IconButton, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';

import { useApertures } from '../../../_contexts/Aperture.Context';
import { useApertureSidebar } from './Sidebar.Context';

import { listItemButtonSx, listItemTextSlopProps, listItemTextSx } from './styles';
import { ApertureType } from '../types';
import { ApertureListItemContentProps } from './types';

const ApertureListItemContent: React.FC<ApertureListItemContentProps> = ({ aperture, isSelected }) => {
    const userContext = useContext(UserContext);
    const { handleSetActiveApertureById } = useApertures();

    return (
        <ListItemButton
            selected={isSelected}
            onClick={() => handleSetActiveApertureById(aperture.id)}
            sx={listItemButtonSx}
        >
            <Stack direction="row" alignItems="center" width="100%">
                <ListItemText primary={aperture.name} slotProps={listItemTextSlopProps} sx={listItemTextSx} />
                {userContext.user && (
                    <>
                        <EditNameButton aperture={aperture} />
                        <DeleteButton aperture={aperture} />
                    </>
                )}
            </Stack>
        </ListItemButton>
    );
};

const EditNameButton: React.FC<{ aperture: ApertureType }> = ({ aperture }) => {
    const { openNameChangeModal } = useApertureSidebar();

    return (
        <Tooltip className="edit-aperture-name-button" title="Aperture Name" placement="right" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.preventDefault();
                        openNameChangeModal(aperture.id, aperture.name);
                    }}
                >
                    <ModeEditOutlinedIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

const DeleteButton: React.FC<{ aperture: ApertureType }> = ({ aperture }) => {
    const { handleDeleteAperture } = useApertures();

    return (
        <Tooltip className="delete-aperture-button" title="Delete Aperture" placement="right" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.preventDefault();
                        handleDeleteAperture(aperture.id);
                    }}
                >
                    <ClearOutlinedIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

export default ApertureListItemContent;
