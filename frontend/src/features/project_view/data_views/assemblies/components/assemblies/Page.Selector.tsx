import React, { useState, useContext } from "react";
import { Box, Button, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import { UserContext } from "../../../../../auth/contexts/UserContext";

import { AssemblyType } from "../../types/Assembly";
import ChangeNameModal from "./Modal.ChangeName";

interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    handleAssemblyChange: (event: SelectChangeEvent<number>) => void;
    handleNameChange: (assemblyId: number, newName: string) => void;
}

const ChangeNameButton: React.FC<{ openModal: () => void }> = ({ openModal }) => {
    return (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            sx={{ marginBottom: 2, minWidth: "120px", color: "inherit" }}
            onClick={openModal}
        >
            Change Name
        </Button>
    )
}


export const AssemblySelector: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    handleAssemblyChange,
    handleNameChange
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

    // Create a sorted copy of the assemblies array
    const sortedAssemblies = [...assemblies].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Box sx={{ display: "flex", alignItems: "top", gap: 2, marginBottom: 2 }}>

            <FormControl className='assembly-selector' fullWidth sx={{ marginBottom: 2 }}>
                <InputLabel id="assembly-select-label">Select Assembly</InputLabel>
                <Select
                    size="medium"
                    labelId="assembly-select-label"
                    value={selectedAssemblyId || ""}
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

            {userContext.user ? (<ChangeNameButton openModal={openModal} />) : null}
            <ChangeNameModal
                open={isModalOpen}
                onClose={closeModal}
                onSubmit={handleSubmitNameChange}
            />
        </Box>
    );
}

