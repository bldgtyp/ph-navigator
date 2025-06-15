import { useEffect, useRef, useContext } from "react";

import { UserContext } from "../../../../../auth/contexts/UserContext";

import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Divider, ButtonGroup } from "@mui/material";
import { OkCancelButtonsProps, HeightInputProps, DeleteButtonProps, LayerHeightModalType } from "./Modal.LayerHeight.Types";


const HeightInput: React.FC<HeightInputProps> = (props) => {
    const userContext = useContext(UserContext);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.select();
        }
    }, []);

    return (
        <TextField
            type="text"
            label="Layer Height"
            value={props.layerHeightInput}
            onChange={props.handleHeightChange}
            fullWidth
            margin="dense"
            autoFocus
            inputRef={inputRef}
            disabled={!userContext.user}
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
    const userContext = useContext(UserContext);
    return (
        <DialogActions sx={{ display: "flex", justifyContent: "center" }}>
            <Button
                color="error"
                size="small"
                fullWidth
                variant="outlined"
                disabled={!userContext.user}
                onClick={() => {
                    const isConfirmed = window.confirm("Are you sure you want to delete this Layer?");
                    if (isConfirmed) {
                        props.handleDeleteLayer();
                    }
                }} >
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
                        layerHeightInput={props.layerHeightMM}
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