import React, { useState } from "react";
import { Box, Button, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import { AssemblyType } from "../../types/Assembly";
import ChangeNameModal from "./Modal.ChangeName";

interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    handleAssemblyChange: (event: SelectChangeEvent<number>) => void;
    handleNameChange: (assemblyId: number, newName: string) => void;
}


export const AssemblySelector: React.FC<AssemblySelectorProps> = ({
    assemblies,
    selectedAssemblyId,
    handleAssemblyChange,
    handleNameChange
}) => {

    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const handleSubmitNameChange = (newName: string) => {
        if (selectedAssemblyId) {
            handleNameChange(selectedAssemblyId, newName);
        }
    };

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
                    {assemblies.map((assembly: any) => (
                        <MenuItem key={assembly.id} value={assembly.id}>
                            {assembly.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Button
                variant="outlined"
                color="primary"
                size="small"
                sx={{ marginBottom: 2, minWidth: "120px", color: "inherit" }}
                onClick={openModal}
            >
                Change Name
            </Button>
            <ChangeNameModal
                open={isModalOpen}
                onClose={closeModal}
                onSubmit={handleSubmitNameChange}
            />
        </Box>
    );
}

