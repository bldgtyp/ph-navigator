import React, { useContext } from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useAssemblyContext } from './Assembly.Context';

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

const AssemblyEditButtons: React.FC = () => {
    const userContext = useContext(UserContext);
    const assemblyContext = useAssemblyContext();

    return userContext.user ? (
        <Box sx={{ display: 'flex', alignItems: 'top', justifyContent: 'right', gap: 2, marginBottom: 2 }}>
            <AssemblyButton
                onClick={() => assemblyContext.handleFlipOrientation(assemblyContext.selectedAssemblyId)}
                text="Flip Orientation"
                hoverText="Flip the interior/exterior orientation."
            />
            <AssemblyButton
                onClick={() => assemblyContext.handleFlipLayers(assemblyContext.selectedAssemblyId)}
                text="Flip Layers"
                hoverText="Reverse the layers from inside to outside."
            />
            <AssemblyButton
                onClick={() => assemblyContext.handleDuplicateAssembly(assemblyContext.selectedAssemblyId)}
                text="Duplicate Assembly"
            />
        </Box>
    ) : (
        <></>
    );
};

export default AssemblyEditButtons;
