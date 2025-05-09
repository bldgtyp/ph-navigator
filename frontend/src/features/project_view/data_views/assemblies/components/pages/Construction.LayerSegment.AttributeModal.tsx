import '../../styles/Construction.css';
import { Divider, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField } from "@mui/material";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { useAssemblies } from '../../contexts/AssembliesContext';
import { useMaterials } from '../../contexts/MaterialsContext';


interface LayerSegmentWidthModalProps {
    isModalOpen: boolean;
    handleModalClose: () => void;
    newWidth: number; // Current width of the segment
    handleWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleWidthSubmit: () => void;
    handleDeleteSegment: () => void;
    materialId: string; // Current material ID for the segment
    handleMaterialChange: (materialId: string) => void;
}


interface DeleteButtonProps {
    handleDeleteSegment: () => void;
}


interface OkCancelButtonsProps {
    handleModalClose: () => void;
}


interface WidthInputProps {
    newWidth: number;
    handleWidthChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}


interface MaterialInputProps {
    materialId: string;
    handleMaterialChange: (materialId: string) => void;
}


const DeleteButton: React.FC<DeleteButtonProps> = (props) => {
    return (
        <DialogActions sx={{ display: "flex", justifyContent: "center" }}>
            <Button onClick={() => {
                const isConfirmed = window.confirm("Are you sure you want to delete this Layer Segment?");
                if (isConfirmed) {
                    props.handleDeleteSegment();
                }
            }} color="error" size="small" fullWidth variant="outlined">
                Delete Segment
            </Button>
        </DialogActions>
    );
}


const OkCancelButtons: React.FC<OkCancelButtonsProps> = (props) => {
    return (<DialogActions sx={{ display: "flex", flexDirection: 'row', justifyContent: "center" }}>
        <ButtonGroup variant="text">
            <Button onClick={props.handleModalClose} size="large" color="primary">
                Cancel
            </Button>
            <Button type="submit" size="large" color="primary">
                Save
            </Button>
        </ButtonGroup>
    </DialogActions>)
}


const WidthInput: React.FC<WidthInputProps> = (props) => {
    return (
        <TextField
            type="number"
            label="Segment Width"
            value={props.newWidth}
            onChange={props.handleWidthChange}
            fullWidth
            margin="dense"
        />
    )
};


const MaterialInput: React.FC<MaterialInputProps> = (props) => {
    const { isLoadingMaterials, materials } = useMaterials();
    const { isLoadingAssemblies, assemblies } = useAssemblies();

    return (
        <FormControl fullWidth margin="dense">
            <InputLabel id="material-select-label">Material</InputLabel>
            <Select
                labelId="material-select-label"
                value={props.materialId}
                onChange={(e) => props.handleMaterialChange(e.target.value)}
                disabled={isLoadingMaterials} // Disable if materials are still loading
            >
                {materials.map((material) => (
                    <MenuItem key={material.id} value={material.id}>
                        {material.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
};

const LayerSegmentAttributeModal: React.FC<LayerSegmentWidthModalProps> = (props) => {
    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose}>
            <DialogTitle>Edit Segment</DialogTitle>
            <Divider />
            <form onSubmit={(e) => { e.preventDefault(); props.handleWidthSubmit(); }}>
                <DialogContent>
                    <MaterialInput materialId={props.materialId} handleMaterialChange={props.handleMaterialChange} />
                    <WidthInput newWidth={props.newWidth} handleWidthChange={props.handleWidthChange} />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>
            <Divider />
            <DeleteButton handleDeleteSegment={props.handleDeleteSegment} />
        </Dialog >
    )
}

export default LayerSegmentAttributeModal;