import React from "react";
import { FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from "@mui/material";

import { AssemblyType } from "../../types/Assembly";


interface AssemblySelectorProps {
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    handleAssemblyChange: (event: SelectChangeEvent<number>) => void;
}


export const AssemblySelector: React.FC<AssemblySelectorProps> = ({ assemblies, selectedAssemblyId, handleAssemblyChange }) => {
    return (
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
    );
}

