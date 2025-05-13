import { useEffect, useRef, useContext } from "react";

import { UserContext } from "../../../../../auth/contexts/UserContext";
import { useMaterials } from '../../contexts/MaterialsContext';

import { List, ListItemText, Autocomplete, Box, Divider, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, FormControl, Typography } from "@mui/material";
import { DeleteButtonProps, OkCancelButtonsProps, WidthInputProps, MaterialInputProps, LayerSegmentWidthModalProps, MaterialDataDisplayProps } from "./Modal.LayerSegment.Types";


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

const MaterialDataDisplay: React.FC<MaterialDataDisplayProps> = (props) => {
    return (
        <Box sx={{ p: 2, marginBottom: "25px", border: "1px solid #ccc", borderRadius: 2, backgroundColor: "#f9f9f9", marginTop: 2 }}>
            <Typography variant="h5" gutterBottom>Layer Segment Material:</Typography>
            <List>
                <ListItemText>Name: {props.selectedMaterial?.name || "--"}</ListItemText>
                <ListItemText>Category: {props.selectedMaterial?.category || "--"}</ListItemText>
                <ListItemText>Conductivity: {props.selectedMaterial?.conductivity_w_mk || "--"} w/mk</ListItemText>
                <ListItemText>Density: {props.selectedMaterial?.density_kg_m3 || "--"} kg/m3</ListItemText>
                <ListItemText>Specific-Heat-Capacity: {props.selectedMaterial?.specific_heat_j_kgk || "--"} J/kg-K</ListItemText>
            </List>
        </Box>
    )
}

const MaterialInput: React.FC<MaterialInputProps> = (props) => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
        return (
            <FormControl fullWidth margin="dense">
                <Box>
                    <Autocomplete
                        options={props.materialOptions}
                        groupBy={(option) => option.category}
                        getOptionLabel={(option) => option.name}
                        value={props.selectedMaterial}
                        onChange={(event, newValue) => {
                            props.handleMaterialChange(newValue?.id || "", newValue?.argb_color || "#ccc");
                        }}
                        disabled={!userContext.user}
                        loading={props.isLoadingMaterials}
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
    }

    return null;
};


const OkCancelButtons: React.FC<OkCancelButtonsProps> = (props) => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
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
    return null;
}


const DeleteButton: React.FC<DeleteButtonProps> = (props) => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
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
    }

    return null;
};


const ModalLayerSegment: React.FC<LayerSegmentWidthModalProps> = (props) => {
    const { isLoadingMaterials, materials } = useMaterials();

    // Sort materials by category
    const materialOptions = [...materials].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return 0;
    });

    // Find the selected material based on the materialId
    const selectedMaterial = materialOptions.find((material) => material.id === props.materialId) || null;

    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle>Segment: {selectedMaterial?.name}</DialogTitle>
            <Divider />

            <form onSubmit={(e) => { e.preventDefault(); props.handleSubmit(); }}>
                <DialogContent>
                    <MaterialInput
                        materialId={props.materialId}
                        materialOptions={materialOptions}
                        selectedMaterial={selectedMaterial}
                        isLoadingMaterials={isLoadingMaterials}
                        handleMaterialChange={props.handleMaterialChange}
                    />
                    <MaterialDataDisplay selectedMaterial={selectedMaterial} />
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