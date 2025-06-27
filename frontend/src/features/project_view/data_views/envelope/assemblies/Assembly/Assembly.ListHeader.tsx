import { Button, Tooltip } from '@mui/material';

interface AssemblyListHeaderProps {
    showAddButton: boolean;
    onAddAssembly: () => void;
}

const AssemblyListHeader: React.FC<AssemblyListHeaderProps> = ({ showAddButton, onAddAssembly }) => {
    if (!showAddButton) return null;

    return (
        <Tooltip title="Add a new Assembly to the Project" placement="top" arrow>
            <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ marginBottom: 2, minWidth: '120px', width: '100%', color: 'inherit' }}
                onClick={onAddAssembly}
            >
                + Add New Assembly
            </Button>
        </Tooltip>
    );
};

export default AssemblyListHeader;
