import { Button, IconButton, List, ListItem, ListItemButton, ListItemText, Stack, Tooltip } from '@mui/material';
import { AssemblyType } from '../../_types/Assembly';
import { useContext, useState } from 'react';
import { UserContext } from '../../../../../auth/_contexts/UserContext';
import ModeEditOutlinedIcon from '@mui/icons-material/ModeEditOutlined';
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

const AddAssemblyButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <Tooltip title="Add a new Assembly to the Project" placement="top" arrow>
            <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ marginBottom: 2, minWidth: '120px', width: '100%', color: 'inherit' }}
                onClick={onClick}
            >
                + Add New Assembly
            </Button>
        </Tooltip>
    );
};

interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    onAssemblyChange: (assemblyId: number) => void;
    onAddAssembly: () => void;
    onDeleteAssembly: (assemblyId: number) => void;
    onNameChange: (assemblyId: number, newName: string) => void; // Add this prop
}

const AssemblySidebar: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    onAssemblyChange,
    onAddAssembly,
    onDeleteAssembly,
    onNameChange,
}) => {
    const userContext = useContext(UserContext);

    // For the Name Change Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [assemblyId, setAssemblyId] = useState<number>(0);
    const [assemblyName, setAssemblyName] = useState<string>('');
    const handleNameChangeModalOpen = () => setIsModalOpen(true);
    const handleNameChangeModalClose = () => setIsModalOpen(false);

    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <>
            <ChangeNameModal
                assemblyName={assemblyName}
                open={isModalOpen}
                onClose={handleNameChangeModalClose}
                onSubmit={value => {
                    onNameChange(assemblyId, value);
                }}
            />
            {userContext.user ? <AddAssemblyButton onClick={onAddAssembly} /> : null}

            <List dense>
                {sortedAssemblies.map((assembly: AssemblyType) => (
                    <ListItem key={assembly.id} component="div" disablePadding>
                        <ListItemButton
                            key={assembly.id}
                            selected={selectedAssemblyId === assembly.id}
                            onClick={event => onAssemblyChange(assembly.id)}
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
                                    key={assembly.id}
                                    slotProps={{
                                        primary: {
                                            sx: {
                                                wordBreak: 'break-word',
                                                whiteSpace: 'normal',
                                                overflow: 'hidden',
                                            },
                                        },
                                    }}
                                    primary={assembly.name}
                                    sx={{ width: '100%' }}
                                />

                                {userContext.user && (
                                    <>
                                        <Tooltip
                                            className="edit-assembly-name-button"
                                            title="Edit Assembly Name"
                                            placement="right"
                                            arrow
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={e => {
                                                    e.preventDefault();
                                                    setAssemblyName(assembly.name);
                                                    setAssemblyId(assembly.id);
                                                    handleNameChangeModalOpen();
                                                }}
                                            >
                                                <ModeEditOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip
                                            className="delete-assembly-button"
                                            title="Delete Assembly"
                                            placement="right"
                                            arrow
                                        >
                                            <IconButton
                                                size="small"
                                                onClick={e => {
                                                    e.preventDefault();
                                                    onDeleteAssembly(assembly.id);
                                                }}
                                            >
                                                <ClearOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                )}
                            </Stack>
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </>
    );
};

export default AssemblySidebar;
