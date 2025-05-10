import { useEffect, useRef } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Divider, ButtonGroup } from "@mui/material";
import { OkCancelButtonsProps, HeightInputProps, DeleteButtonProps, LayerHeightModalType } from "./Modal.LayerHeight.Types";


const HeightInput: React.FC<HeightInputProps> = (props) => {
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
            label="Layer Height"
            value={props.layerHeightMM}
            onChange={props.handleHeightChange}
            fullWidth
            margin="dense"
            autoFocus
            inputRef={inputRef}
        />
    )
}


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
                const isConfirmed = window.confirm("Are you sure you want to delete this Layer?");
                if (isConfirmed) {
                    props.handleDeleteLayer();
                }
            }} color="error" size="small" fullWidth variant="outlined">
                Delete Layer
            </Button>
        </DialogActions>
    );
}


const ModalLayerHeight: React.FC<LayerHeightModalType> = (props) => {

    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose}>
            <DialogTitle>Layer</DialogTitle>
            <Divider />
            <form onSubmit={(e) => { e.preventDefault(); props.handleSubmit(); }} >
                <DialogContent>
                    <HeightInput
                        layerHeightMM={props.layerHeightMM}
                        handleHeightChange={props.handleHeightChange}
                    />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>
            <Divider />
            <DeleteButton handleDeleteLayer={props.handleDeleteLayer} />
        </Dialog>
    )
}


export default ModalLayerHeight;