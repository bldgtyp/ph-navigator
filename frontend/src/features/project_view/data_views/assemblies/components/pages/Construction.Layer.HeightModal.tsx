import '../../styles/Construction.css';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from "@mui/material";


type LayerHeightModalType = {
    isModalOpen: boolean;
    handleModalClose: () => void;
    newLayerHeight: number;
    handleHeightChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleHeightSubmit: () => void;
}

const LayerHeightModal: React.FC<LayerHeightModalType> = (props) => {
    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose}>
            <DialogTitle>Edit Layer</DialogTitle>

            <DialogContent>
                <TextField
                    type="number"
                    label="Layer Height"
                    value={props.newLayerHeight}
                    onChange={props.handleHeightChange}
                    fullWidth
                    margin="dense"
                />
            </DialogContent>


            <DialogActions>
                <Button onClick={props.handleModalClose} color="secondary">
                    Cancel
                </Button>
                <Button onClick={props.handleHeightSubmit} color="primary">
                    Save
                </Button>
            </DialogActions>

        </Dialog>
    )
}

export default LayerHeightModal;