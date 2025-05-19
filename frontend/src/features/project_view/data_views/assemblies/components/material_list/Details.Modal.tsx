import { useContext } from "react";

import { UserContext } from "../../../../../auth/contexts/UserContext";

import { TextareaAutosize, List, Box, ListItemText, Typography, Divider, ButtonGroup, Dialog, DialogActions, DialogTitle, DialogContent, Button } from "@mui/material";
import { OkCancelButtonsProps, MaterialDataProps, DetailsModalProps } from "./Details.Modal.Types";


const detailBlockStyle = { p: 2, marginBottom: "25px", border: "1px solid #ccc", borderRadius: 1, backgroundColor: "#f9f9f9", marginTop: 2 }

const MaterialData: React.FC<MaterialDataProps> = (props) => {
    return (
        <Box sx={detailBlockStyle}>
            <Typography variant="h5" gutterBottom>Material:</Typography>
            <List dense sx={{}}>
                <ListItemText>Name: {props.material?.name || "--"}</ListItemText>
                <ListItemText>Category: {props.material?.category || "--"}</ListItemText>
                <ListItemText>Conductivity: {props.material?.conductivity_w_mk || "--"} w/mk</ListItemText>
                <ListItemText>Density: {props.material?.density_kg_m3 || "--"} kg/m3</ListItemText>
                <ListItemText>Specific-Heat-Capacity: {props.material?.specific_heat_j_kgk || "--"} J/kg-K</ListItemText>
            </List>
        </Box>
    )
}

interface MaterialNotesProps {
    currentNotes: string;
    handleNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const MaterialNotes: React.FC<MaterialNotesProps> = (props) => {
    const userContext = useContext(UserContext);

    return (
        <Box sx={detailBlockStyle}>
            <Typography variant="h5" gutterBottom>Notes:</Typography>
            <TextareaAutosize
                minRows={4}
                placeholder={"Add notes here..."}
                defaultValue={props.currentNotes}
                style={{ width: "100%", maxWidth: "100%" }}
                onChange={props.handleNotesChange}
                disabled={!userContext.user}
            />
        </Box>
    )
}

const OkCancelButtons: React.FC<OkCancelButtonsProps> = (props) => {
    const userContext = useContext(UserContext);

    return (
        <DialogActions sx={{ display: "flex", flexDirection: 'row', justifyContent: "center" }}>
            {userContext.user ? (
                <ButtonGroup variant="text">
                    <Button onClick={props.handleModalClose} size="large" color="primary">
                        Cancel
                    </Button>
                    <Button type="submit" size="large" color="primary">
                        Save
                    </Button>
                </ButtonGroup>
            ) : (
                <ButtonGroup variant="contained">
                    <Button type="submit">OK</Button>
                </ButtonGroup>
            )}
        </DialogActions>
    )
}

const DetailsModal: React.FC<DetailsModalProps> = (props) => {
    return (
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle>{props.segment.material.name}</DialogTitle>
            <Divider />

            <form onSubmit={(e) => { e.preventDefault(); props.handleSubmit(e); }}>
                <DialogContent sx={{ display: "flex", flexDirection: "column" }}>
                    <MaterialData material={props.segment.material} />
                    <MaterialNotes currentNotes={props.currentNotes} handleNotesChange={props.handleNotesChange} />
                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>

            <Divider />
        </Dialog >
    )

}

export default DetailsModal;