import { List, ListItemButton, ListItemText } from '@mui/material';
import { AssemblyType } from '../../_types/Assembly';

interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    handleAssemblyChange: (assemblyId: number) => void;
}

const AssemblySidebar: React.FC<AssemblySelectorProps> = ({ assemblies, selectedAssemblyId, handleAssemblyChange }) => {
    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <List dense>
            {sortedAssemblies.map((assembly: any) => (
                <ListItemButton
                    key={assembly.id}
                    selected={selectedAssemblyId === assembly.id}
                    onClick={event => handleAssemblyChange(assembly.id)}
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
            ))}
        </List>
    );
};

export default AssemblySidebar;
