import { useContext, useState } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { Box, IconButton, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';

import { useApertures } from '../../../_contexts/Aperture.Context';
import { useApertureSidebar } from './Sidebar.Context';

import { listItemButtonSx, listItemTextSlopProps, listItemTextSx } from './styles';
import { ApertureType } from '../types';
import { ApertureListItemContentProps } from './types';

const ApertureListItemContent: React.FC<ApertureListItemContentProps> = ({ aperture, isSelected }) => {
    const userContext = useContext(UserContext);
    const { handleSetActiveApertureById } = useApertures();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <ListItemButton
            selected={isSelected}
            onClick={() => handleSetActiveApertureById(aperture.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={listItemButtonSx}
        >
            <Stack direction="row" alignItems="center" width="100%">
                <ListItemText primary={aperture.name} slotProps={listItemTextSlopProps} sx={listItemTextSx} />
                {userContext.user && (
                    <Box
                        display="flex"
                        sx={{
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.15s ease-in-out',
                        }}
                    >
                        <EditNameButton aperture={aperture} />
                        <DuplicateButton aperture={aperture} />
                        <DeleteButton aperture={aperture} />
                    </Box>
                )}
            </Stack>
        </ListItemButton>
    );
};

const EditNameButton: React.FC<{ aperture: ApertureType }> = ({ aperture }) => {
    const { openNameChangeModal } = useApertureSidebar();

    return (
        <Tooltip className="edit-aperture-name-button" title="Edit Name" placement="bottom" arrow>
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

const DuplicateButton: React.FC<{ aperture: ApertureType }> = ({ aperture }) => {
    const { handleDuplicateAperture } = useApertures();

    return (
        <Tooltip className="duplicate-aperture-button" title="Duplicate Aperture" placement="bottom" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.preventDefault();
                        handleDuplicateAperture(aperture.id);
                    }}
                >
                    <ContentCopyIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

const DeleteButton: React.FC<{ aperture: ApertureType }> = ({ aperture }) => {
    const { handleDeleteAperture } = useApertures();

    return (
        <Tooltip className="delete-aperture-button" title="Delete Aperture" placement="bottom" arrow>
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
