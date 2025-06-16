import React, { useState, useContext } from 'react';
import { Box, Button, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';

import { AssemblyType } from '../../../types/Assembly';
import ChangeNameModal from '../ChangeNameModal/Modal.ChangeName';

interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    handleAssemblyChange: (event: SelectChangeEvent<number>) => void;
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

export const AssemblySelector: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    handleAssemblyChange,
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

    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Box sx={{ display: 'flex', alignItems: 'top', gap: 2, marginBottom: 2 }}>
            <FormControl className="assembly-selector" fullWidth sx={{ marginBottom: 2 }}>
                <InputLabel id="assembly-select-label">Select Assembly</InputLabel>
                <Select
                    size="medium"
                    labelId="assembly-select-label"
                    value={selectedAssemblyId || ''}
                    onChange={handleAssemblyChange}
                    label="Select Assembly"
                >
                    {sortedAssemblies.map((assembly: any) => (
                        <MenuItem key={assembly.id} value={assembly.id}>
                            {assembly.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {userContext.user ? <ChangeNameButton openModal={openModal} /> : null}
            <ChangeNameModal open={isModalOpen} onClose={closeModal} onSubmit={handleSubmitNameChange} />
            {userContext.user ? <FlipOrientationButton onClick={handleSubmitFlipOrientation} /> : null}
            {userContext.user ? <FlipLayersButton onClick={handleSubmitFlipLayers} /> : null}
        </Box>
    );
};
