import { useEffect, useRef, useContext } from "react";

import { UserContext } from "../../../../../auth/contexts/UserContext";
import { useMaterials } from '../../contexts/MaterialsContext';

import { Autocomplete, Box, Divider, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, MenuItem, InputLabel, FormControl, Typography } from "@mui/material";
import { DeleteButtonProps, OkCancelButtonsProps, WidthInputProps, MaterialInputProps, LayerSegmentWidthModalProps } from "./Modal.LayerSegment.Types";


const WidthInput: React.FC<WidthInputProps> = (props) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const userContext = useContext(UserContext);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.select(); // Automatically select all text
        }
    }, []);

    return (
        <TextField
            type="number"
            slotProps={{
                htmlInput: { step: "any", }
            }}
            label="Segment Width"
            value={props.widthMM}
            onChange={props.handleWidthChange}
            fullWidth
            margin="dense"
            autoFocus
            inputRef={inputRef}
            disabled={!userContext.user}
        />
    )
};


const MaterialInput: React.FC<MaterialInputProps> = (props) => {
    const { isLoadingMaterials, materials } = useMaterials();
    const userContext = useContext(UserContext);

    // Sort materials by category
    const materialOptions = [...materials].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return 0;
    });

    // Find the selected material based on the materialId
    const selectedMaterial = materialOptions.find((material) => material.id === props.materialId) || null;

    return (
        <FormControl fullWidth margin="dense">
            <Box>
                <Autocomplete
                    options={materialOptions}
                    groupBy={(option) => option.category}
                    getOptionLabel={(option) => option.name}
                    value={selectedMaterial}
                    onChange={(event, newValue) => {
                        props.handleMaterialChange(newValue?.id || "", newValue?.argb_color || "#ccc");
                    }}
                    disabled={!userContext.user}
                    loading={isLoadingMaterials}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Select a material"
                            placeholder="Select a material"
                            fullWidth
                        />
                    )}
                />
            </Box>
        </FormControl>
    );
};


const OkCancelButtons: React.FC<OkCancelButtonsProps> = (props) => {
    return (
        <DialogActions sx={{ display: "flex", flexDirection: 'row', justifyContent: "center" }}>
            <ButtonGroup variant="text">
                <Button onClick={props.handleModalClose} size="large" color="primary">
                    Cancel
                </Button>
                <Button type="submit" size="large" color="primary">
                    Save
                </Button>
            </ButtonGroup>
        </DialogActions>
    )
}


const DeleteButton: React.FC<DeleteButtonProps> = (props) => {
    const userContext = useContext(UserContext);

    return (
        <DialogActions sx={{ display: "flex", justifyContent: "center" }}>
            <Button
                color="error"
                size="small"
                fullWidth variant="outlined"
                disabled={!userContext.user}
                onClick={() => {
                    const isConfirmed = window.confirm("Are you sure you want to delete this Layer Segment?");
                    if (isConfirmed) {
                        props.handleDeleteSegment(props.segmentId); // Pass the segment ID to the handler
                    }
                }} >
                Delete Segment
            </Button>
        </DialogActions>
    );
};


const ModalLayerSegment: React.FC<LayerSegmentWidthModalProps> = (props) => {
    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle>Segment</DialogTitle>
            <Divider />
            <form onSubmit={(e) => { e.preventDefault(); props.handleSubmit(); }}>
                <DialogContent>
                    <MaterialInput materialId={props.materialId} handleMaterialChange={props.handleMaterialChange} />
                    <WidthInput widthMM={props.widthMM} handleWidthChange={props.handleWidthChange} />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>
            <Divider />
            <DeleteButton handleDeleteSegment={props.handleDeleteSegment} segmentId={props.segmentId} />
        </Dialog >
    )
}

export default ModalLayerSegment;