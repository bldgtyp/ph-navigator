import { useContext } from 'react';
import { UserContext } from '../../../../../../../auth/_contexts/UserContext';
import { IconButton, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
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

    return (
        <ListItemButton selected={isSelected} onClick={() => handleAssemblyChange(assembly.id)} sx={listItemButtonSx}>
            <Stack direction="row" alignItems="center" width="100%">
                <ListItemText primary={assembly.name} slotProps={listItemTextSlopProps} sx={listItemTextSx} />
                {userContext.user && (
                    <>
                        <EditNameButton assembly={assembly} />
                        <DeleteButton assembly={assembly} />
                    </>
                )}
            </Stack>
        </ListItemButton>
    );
};

const EditNameButton: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { openNameChangeModal } = useAssemblySidebar();

    return (
        <Tooltip className="edit-assembly-name-button" title="Assembly Name" placement="right" arrow>
            <IconButton
                size="small"
                onClick={e => {
                    e.preventDefault();
                    openNameChangeModal(assembly.id, assembly.name);
                }}
            >
                <ModeEditOutlinedIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
};

const DeleteButton: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const { handleDeleteAssembly } = useAssemblyContext();

    return (
        <Tooltip className="delete-assembly-button" title="Delete Assembly" placement="right" arrow>
            <IconButton
                size="small"
                onClick={e => {
                    e.preventDefault();
                    handleDeleteAssembly(assembly.id);
                }}
            >
                <ClearOutlinedIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
};

export default AssemblyListItemContent;
