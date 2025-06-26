import { Button, IconButton, List, ListItem, ListItemButton, ListItemText, Tooltip } from '@mui/material';
import { AssemblyType } from '../../_types/Assembly';
import { useContext } from 'react';
import { UserContext } from '../../../../../auth/_contexts/UserContext';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';

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
}

const AssemblySidebar: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    onAssemblyChange,
    onAddAssembly,
    onDeleteAssembly,
}) => {
    const userContext = useContext(UserContext);

    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <>
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
                        </ListItemButton>

                        {userContext.user ? (
                            <Tooltip className="delete-assembly-button" title="Delete Assembly" placement="right" arrow>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        onDeleteAssembly(assembly.id);
                                    }}
                                >
                                    <RemoveCircleOutlineOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        ) : null}
                    </ListItem>
                ))}
            </List>
        </>
    );
};

export default AssemblySidebar;
