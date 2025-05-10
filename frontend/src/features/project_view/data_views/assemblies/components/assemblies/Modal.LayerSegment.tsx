import { useEffect, useRef } from "react";
import { Divider, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { useMaterials } from '../../contexts/MaterialsContext';
import { DeleteButtonProps, OkCancelButtonsProps, WidthInputProps, MaterialInputProps, LayerSegmentWidthModalProps } from "./Modal.LayerSegment.Types";


const WidthInput: React.FC<WidthInputProps> = (props) => {
    const inputRef = useRef<HTMLInputElement>(null);

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
        />
    )
};


const MaterialInput: React.FC<MaterialInputProps> = (props) => {
    const { isLoadingMaterials, materials } = useMaterials();

    return (
        <FormControl fullWidth margin="dense">
            <InputLabel id="material-select-label">Material</InputLabel>
            <Select
                labelId="material-select-label"
                value={props.materialId} // Use the temporary material ID
                onChange={(e) => props.handleMaterialChange(e.target.value)} // Update temporary state
                disabled={isLoadingMaterials} // Disable if materials are still loading
            >
                {materials.map((material) => (
                    <MenuItem key={material.id} value={material.id}>
                        {material.name}
                    </MenuItem>
                ))}
            </Select>
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
    return (
        <DialogActions sx={{ display: "flex", justifyContent: "center" }}>
            <Button onClick={() => {
                const isConfirmed = window.confirm("Are you sure you want to delete this Layer Segment?");
                if (isConfirmed) {
                    props.handleDeleteSegment(props.segmentId); // Pass the segment ID to the handler
                }
            }} color="error" size="small" fullWidth variant="outlined">
                Delete Segment
            </Button>
        </DialogActions>
    );
};


const ModalLayerSegment: React.FC<LayerSegmentWidthModalProps> = (props) => {
    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose}>
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