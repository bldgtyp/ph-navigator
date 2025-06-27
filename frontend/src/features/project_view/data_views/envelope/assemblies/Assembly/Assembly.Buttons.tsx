import React, { useContext } from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useAssembly } from '../_contexts/Assembly.Context';
import { useLoadAssemblies } from '../_contexts/Assembly.Hooks';

const AssemblyButton: React.FC<{ onClick: () => void; text: string; hoverText?: string }> = ({
    onClick,
    text,
    hoverText = '',
}) => {
    return (
        <Tooltip title={hoverText} placement="top" arrow>
            <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ marginBottom: 2, minWidth: '120px', color: 'inherit' }}
                onClick={onClick}
            >
                {text}
            </Button>
        </Tooltip>
    );
};

const AssemblyButtons: React.FC = () => {
    const userContext = useContext(UserContext);
    const assemblyContext = useAssembly();
    const { handleFlipOrientation, handleFlipLayers, handleDuplicateAssembly } = useLoadAssemblies();

    return userContext.user ? (
        <Box sx={{ display: 'flex', alignItems: 'top', justifyContent: 'right', gap: 2, marginBottom: 2 }}>
            <AssemblyButton
                onClick={() => handleFlipOrientation(assemblyContext.selectedAssemblyId)}
                text="Flip Orientation"
                hoverText="Flip the interior/exterior orientation."
            />
            <AssemblyButton
                onClick={() => handleFlipLayers(assemblyContext.selectedAssemblyId)}
                text="Flip Layers"
                hoverText="Reverse the layers from inside to outside."
            />
            <AssemblyButton
                onClick={() => handleDuplicateAssembly(assemblyContext.selectedAssemblyId)}
                text="Duplicate Assembly"
            />
        </Box>
    ) : (
        <></>
    );
};

export default AssemblyButtons;
