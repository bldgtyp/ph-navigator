import { Button, Tooltip } from '@mui/material';
import { useContext } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';

interface AssemblyListHeaderProps {
    onAddAssembly: () => void;
}

const AssemblyListHeader: React.FC<AssemblyListHeaderProps> = ({ onAddAssembly }) => {
    const userContext = useContext(UserContext);
    if (!userContext.user) return null;

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
