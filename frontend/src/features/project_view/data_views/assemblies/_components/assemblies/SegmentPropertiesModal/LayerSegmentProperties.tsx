import { useEffect, useRef, useContext } from "react";
import { List, ListItemText, Autocomplete, Box, Divider, ButtonGroup, Dialog, DialogActions, DialogContent, DialogTitle, Button, TextField, FormControl, Typography, FormControlLabel, Checkbox } from "@mui/material";

import { UserContext } from "../../../../../../auth/_contexts/UserContext";
import { useMaterials } from '../../../_contexts/MaterialsContext';

import { useUnitConversion } from "../../../../../_hooks/useUnitConversion";
import { Unit } from "../../../../../../../formatters/Unit.ConversionFactors";
import { DeleteButtonProps, OkCancelButtonsProps, WidthInputProps, MaterialInputProps, LayerSegmentWidthModalProps, MaterialDataDisplayProps } from "./LayerSegmentProperties.Types";


const WidthInput: React.FC<WidthInputProps> = (props) => {
    const { valueInCurrentUnitSystem, unitSystem } = useUnitConversion()
    const userContext = useContext(UserContext);
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
            label={`Segment Width [${unitSystem === "SI" ? "mm" : "inch"}]`}
            defaultValue={Number(valueInCurrentUnitSystem(props.widthMM, "mm", "in")).toFixed(unitSystem === "SI" ? 1 : 3)}
            onChange={props.onSegmentWidthChange}
            fullWidth
            margin="dense"
            autoFocus
            inputRef={inputRef}
            disabled={!userContext.user}
        />
    )
};


const MaterialDataDisplay: React.FC<MaterialDataDisplayProps> = (props) => {
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion()

    const convertValue = (value: number | undefined, siUnit: Unit, ipUnit: Unit, decimal: number) => {
        if (value === undefined || value === null || value === 0.0) return "--";
        return valueInCurrentUnitSystemWithDecimal(value, siUnit, ipUnit, decimal)
    }

    return (
        <Box sx={{ p: 2, marginBottom: "25px", border: "1px solid #ccc", borderRadius: 1, backgroundColor: "#f9f9f9", marginTop: 2 }}>
            <Typography variant="h5" gutterBottom>Layer Segment Material:</Typography>
            <List dense sx={{}}>
                <ListItemText>Name: {props.selectedMaterial?.name || "--"}</ListItemText>
                <ListItemText>Category: {props.selectedMaterial?.category || "--"}</ListItemText>
                <ListItemText>
                    {unitSystem === "SI" ? 'Conductivity [w/mk]' : 'Resistivity [R/inch]'} : {
                        convertValue(props.selectedMaterial?.conductivity_w_mk, "w/mk", "hr-ft2-F/btu-in", 3)}
                </ListItemText>
                <ListItemText>Density {unitSystem === "SI" ? ' [kg/m3]' : ' [lb/ft3]'} : {
                    convertValue(props.selectedMaterial?.density_kg_m3, "kg/m3", "lb/ft3", 1)}

                </ListItemText>
                <ListItemText>Specific-Heat-Capacity {unitSystem === "SI" ? ' [J/kg-K]' : ' [Btu/lb-F]'} : {
                    convertValue(props.selectedMaterial?.specific_heat_j_kgk, "J/kg-K", "Btu/lb-F", 2)}

                </ListItemText>
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
        <Dialog open={props.isModalOpen} onClose={props.handleModalClose} fullWidth maxWidth="sm">
            <DialogTitle>Segment: {selectedMaterial?.name}</DialogTitle>
            <Divider />

            <form onSubmit={(e) => { e.preventDefault(); props.handleSubmit(); }}>
                <DialogContent sx={{ display: "flex", flexDirection: "column" }}>
                    <MaterialInput
                        materialId={props.materialId}
                        materialOptions={materialOptions}
                        selectedMaterial={selectedMaterial}
                        isLoadingMaterials={isLoadingMaterials}
                        handleMaterialChange={props.handleMaterialChange}
                    />
                    <MaterialDataDisplay selectedMaterial={selectedMaterial} />
                    <WidthInput widthMM={props.widthMM} onSegmentWidthChange={props.onSegmentWidthChange} />

                    <h4>Segment Attributes:</h4>
                    {/* Continuous Insulation Checkbox */}
                    {userContext.user && (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={props.isConInsulationChecked}
                                    onChange={props.handleConInsulationChange}
                                    color="primary"
                                    disabled={!userContext.user}
                                />
                            }
                            label="Continuous Insulation (for Steel Stud Walls)"
                        />
                    )}


                    {/* Checkbox for steel stud spacing */}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={props.steelStudChecked}
                                onChange={props.handleCheckboxChange}
                                color="primary"
                                disabled={!userContext.user}
                            />
                        }
                        label="Steel Stud Layer"
                    />


                    {/* Conditionally render the spacing input */}
                    {props.steelStudChecked && (
                        <TextField
                            type="number"
                            slotProps={{
                                htmlInput: { step: "any", }
                            }}
                            label="Steel Stud Spacing (mm)"
                            value={props.steelStudSpacing}
                            onChange={props.handleSteelStudSpacingChange}
                            fullWidth
                            margin="dense"
                            size="small"
                            disabled={!userContext.user}
                        />
                    )}

                </DialogContent>
                <OkCancelButtons handleModalClose={props.handleModalClose} />
            </form>

            <Divider />
            <DeleteButton handleDeleteSegment={props.handleDeleteSegment} segmentId={props.segmentId} />
        </Dialog >
    )
}

export default ModalLayerSegment;