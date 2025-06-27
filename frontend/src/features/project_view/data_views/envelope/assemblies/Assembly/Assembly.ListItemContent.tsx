import { IconButton, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import { AssemblyType } from '../../_types/Assembly';
import { AssemblyListItemContentProps, AssemblyControlsProps } from './Assembly.ListItemContent.Types';

const AssemblyListItemContent: React.FC<AssemblyListItemContentProps> = ({
    assembly,
    isSelected,
    showControls,
    onSelect,
    onEditName,
    onDelete,
}) => {
    return (
        <ListItemButton
            selected={isSelected}
            onClick={() => onSelect(assembly.id)}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
            }}
        >
            <Stack direction="row" alignItems="center" width="100%">
                <ListItemText
                    primary={assembly.name}
                    slotProps={{
                        primary: {
                            sx: {
                                wordBreak: 'break-word',
                                whiteSpace: 'normal',
                                overflow: 'hidden',
                            },
                        },
                    }}
                    sx={{ width: '100%' }}
                />

                {showControls && <AssemblyControls assembly={assembly} onEdit={onEditName} onDelete={onDelete} />}
            </Stack>
        </ListItemButton>
    );
};

const AssemblyControls: React.FC<AssemblyControlsProps> = ({ assembly, onEdit, onDelete }) => {
    return (
        <>
            <EditNameButton assembly={assembly} onEdit={onEdit} />
            <DeleteButton assemblyId={assembly.id} onDelete={onDelete} />
        </>
    );
};

const EditNameButton: React.FC<{ assembly: AssemblyType; onEdit: (id: number, name: string) => void }> = ({
    assembly,
    onEdit,
}) => {
    return (
        <Tooltip className="edit-assembly-name-button" title="Assembly Name" placement="right" arrow>
            <IconButton
                size="small"
                onClick={e => {
                    e.preventDefault();
                    onEdit(assembly.id, assembly.name);
                }}
            >
                <ModeEditOutlinedIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
};

const DeleteButton: React.FC<{ assemblyId: number; onDelete: (id: number) => void }> = ({ assemblyId, onDelete }) => {
    return (
        <Tooltip className="delete-assembly-button" title="Delete Assembly" placement="right" arrow>
            <IconButton
                size="small"
                onClick={e => {
                    e.preventDefault();
                    onDelete(assemblyId);
                }}
            >
                <ClearOutlinedIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
};

export default AssemblyListItemContent;
