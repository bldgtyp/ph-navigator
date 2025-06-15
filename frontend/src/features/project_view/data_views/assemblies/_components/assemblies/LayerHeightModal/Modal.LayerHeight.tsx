import { useEffect, useRef, useContext } from "react";

import { UserContext } from "../../../../../../auth/_contexts/UserContext";

import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, Divider, ButtonGroup } from "@mui/material";
import { OkCancelButtonsProps, HeightInputProps, DeleteButtonProps, LayerHeightModalType } from "./Modal.LayerHeight.Types";
import { useUnitSystem } from "../../../../../_contexts/UnitSystemContext";
import { useUnitConversion } from "../../../../../_hooks/useUnitConversion";


const HeightInput: React.FC<HeightInputProps> = (props) => {
    const userContext = useContext(UserContext);
    const { valueInCurrentUnitSystem } = useUnitConversion()
    const inputRef = useRef<HTMLInputElement>(null);
    const { unitSystem } = useUnitSystem();

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.select();
        }
    }, []);

    return (
        <>
            <TextField
                type="Number"
                label={`Layer Height [${unitSystem === "SI" ? "mm" : "inch"}]`}
                defaultValue={Number(valueInCurrentUnitSystem(props.layerThicknessUserInput, "mm", "in")).toFixed(unitSystem === "SI" ? 1 : 3)}
                onChange={props.handleLayerThicknessUserInputChange}
                fullWidth
                margin="dense"
                autoFocus
                inputRef={inputRef}
                disabled={!userContext.user}
            />
        </>
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


const ModalLayerThickness: React.FC<LayerHeightModalType> = (props) => {

    return (
        <Dialog open={props.isModalOpen} onClose={props.onModalClose}>
            <DialogTitle>Layer</DialogTitle>
            <Divider />
            <form onSubmit={(e) => { e.preventDefault(); props.onSubmit(); }} >
                <DialogContent>
                    <HeightInput
                        layerThicknessUserInput={props.layerThickness}
                        handleLayerThicknessUserInputChange={props.onLayerThicknessChange}
                    />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.onModalClose} />
            </form>
            <Divider />
            <DeleteButton handleDeleteLayer={props.onDeleteLayer} />
        </Dialog>
    )
}

export default ModalLayerThickness;