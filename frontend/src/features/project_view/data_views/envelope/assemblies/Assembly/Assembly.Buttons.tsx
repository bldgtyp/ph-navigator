import React, { useContext } from 'react';
import { Box, Button, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { AssemblyButtonProps } from './Assembly.Buttons.Types';

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

const AssemblyButtons: React.FC<AssemblyButtonProps> = ({
    selectedAssemblyId,
    onFlipOrientation,
    onFlipLayers,
    onDuplicateAssembly,
}) => {
    const userContext = useContext(UserContext);

    const handleSubmitFlipOrientation = () => {
        if (selectedAssemblyId) {
            onFlipOrientation(selectedAssemblyId);
        }
    };

    const handleSubmitFlipLayers = () => {
        if (selectedAssemblyId) {
            onFlipLayers(selectedAssemblyId);
        }
    };

    const handleDuplicateAssembly = () => {
        if (selectedAssemblyId) {
            onDuplicateAssembly(selectedAssemblyId);
        }
    };

    return userContext.user ? (
        <Box sx={{ display: 'flex', alignItems: 'top', justifyContent: 'right', gap: 2, marginBottom: 2 }}>
            <AssemblyButton
                onClick={handleSubmitFlipOrientation}
                text="Flip Orientation"
                hoverText="Flip the interior/exterior orientation."
            />
            <AssemblyButton
                onClick={handleSubmitFlipLayers}
                text="Flip Layers"
                hoverText="Reverse the layers from inside to outside."
            />
            <AssemblyButton onClick={handleDuplicateAssembly} text="Duplicate Assembly" />
        </Box>
    ) : (
        <></>
    );
};

export default AssemblyButtons;
