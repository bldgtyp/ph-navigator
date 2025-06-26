import React, { useState, useContext } from 'react';
import { Box, Button } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

interface AssemblyButtonProps {
    selectedAssemblyId: number | null;
    handleNameChange: (assemblyId: number, newName: string) => void;
    handleFlipOrientation: (assemblyId: number) => void;
    handleFlipLayers: (assemblyId: number) => void;
}

const ChangeNameButton: React.FC<{ openModal: () => void }> = ({ openModal }) => {
    return (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ marginBottom: 2, minWidth: '120px', color: 'inherit' }}
            onClick={openModal}
        >
            Change Name
        </Button>
    );
};

const FlipOrientationButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ marginBottom: 2, minWidth: '120px', color: 'inherit' }}
            onClick={onClick}
        >
            Flip Orientation
        </Button>
    );
};

const FlipLayersButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ marginBottom: 2, minWidth: '120px', color: 'inherit' }}
            onClick={onClick}
        >
            Flip Layers
        </Button>
    );
};

export const AssemblyButtons: React.FC<AssemblyButtonProps> = ({
    selectedAssemblyId,
    handleNameChange,
    handleFlipOrientation,
    handleFlipLayers,
}) => {
    const userContext = useContext(UserContext);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleSubmitNameChange = (newName: string) => {
        if (selectedAssemblyId) {
            handleNameChange(selectedAssemblyId, newName);
        }
    };

    const handleSubmitFlipOrientation = () => {
        if (selectedAssemblyId) {
            handleFlipOrientation(selectedAssemblyId);
        }
    };

    const handleSubmitFlipLayers = () => {
        if (selectedAssemblyId) {
            handleFlipLayers(selectedAssemblyId);
        }
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'top', justifyContent: 'right', gap: 2, marginBottom: 2 }}>
            {userContext.user ? <ChangeNameButton openModal={openModal} /> : null}
            <ChangeNameModal open={isModalOpen} onClose={closeModal} onSubmit={handleSubmitNameChange} />
            {userContext.user ? <FlipOrientationButton onClick={handleSubmitFlipOrientation} /> : null}
            {userContext.user ? <FlipLayersButton onClick={handleSubmitFlipLayers} /> : null}
        </Box>
    );
};
