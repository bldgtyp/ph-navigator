import { useContext, useState } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { Box, IconButton, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';

import { useAssemblyContext } from '../Assembly.Context';
import { useAssemblySidebar } from './Sidebar.Context';

import { AssemblyType } from '../../../_types/Assembly';
import { listItemButtonSx, listItemTextSlopProps, listItemTextSx } from './Sidebar.ListItemContent.Styles';

const AssemblyListItemContent: React.FC<{ assembly: AssemblyType; isSelected: boolean }> = ({
    assembly,
    isSelected,
}) => {
    const userContext = useContext(UserContext);
    const { handleAssemblyChange } = useAssemblyContext();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <ListItemButton
            selected={isSelected}
            onClick={() => handleAssemblyChange(assembly.id)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            sx={listItemButtonSx}
        >
            <Stack direction="row" alignItems="center" width="100%">
                <ListItemText primary={assembly.name} slotProps={listItemTextSlopProps} sx={listItemTextSx} />
                {userContext.user && (
                    <Box
                        display="flex"
                        sx={{
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.15s ease-in-out',
                        }}
                    >
                        <EditNameButton assembly={assembly} />
                        <DuplicateButton assembly={assembly} />
                        <DeleteButton assembly={assembly} />
                    </Box>
                )}
            </Stack>
        </ListItemButton>
    );
};

const EditNameButton: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { openNameChangeModal } = useAssemblySidebar();

    return (
        <Tooltip className="edit-assembly-name-button" title="Assembly Name" placement="bottom" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.stopPropagation();
                        openNameChangeModal(assembly.id, assembly.name);
                    }}
                >
                    <ModeEditOutlinedIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

const DuplicateButton: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { handleDuplicateAssembly } = useAssemblyContext();

    return (
        <Tooltip className="duplicate-assembly-button" title="Duplicate Assembly" placement="bottom" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.stopPropagation();
                        handleDuplicateAssembly(assembly.id);
                    }}
                >
                    <ContentCopyIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

const DeleteButton: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { handleDeleteAssembly } = useAssemblyContext();

    return (
        <Tooltip className="delete-assembly-button" title="Delete Assembly" placement="bottom" arrow>
            <span>
                <IconButton
                    size="small"
                    onClick={e => {
                        e.stopPropagation();
                        handleDeleteAssembly(assembly.id);
                    }}
                >
                    <ClearOutlinedIcon fontSize="small" />
                </IconButton>
            </span>
        </Tooltip>
    );
};

export default AssemblyListItemContent;
