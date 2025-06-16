import { useEffect, useRef, useContext } from 'react';
import {
    List,
    ListItemText,
    Autocomplete,
    Box,
    Divider,
    ButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    TextField,
    FormControl,
    Typography,
    FormControlLabel,
    Checkbox,
} from '@mui/material';

import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useMaterials } from '../../../_contexts/MaterialsContext';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';
import { Unit } from '../../../../../../../formatters/Unit.ConversionFactors';
import {
    DeleteButtonProps,
    OkCancelButtonsProps,
    WidthInputProps,
    MaterialInputProps,
    LayerSegmentWidthModalProps,
    MaterialDataDisplayProps,
    SteelStudSpacingInputProps,
} from './LayerSegmentProperties.Types';

const WidthInput: React.FC<WidthInputProps> = props => {
    const { valueInSIUnits, valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
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
                htmlInput: { step: 'any' },
            }}
            label={`Segment Width [${unitSystem === 'SI' ? 'mm' : 'inch'}]`}
            defaultValue={valueInCurrentUnitSystemWithDecimal(props.widthMM, 'mm', 'in', unitSystem === 'SI' ? 1 : 3)}
            onChange={e => {
                props.onSegmentWidthChange({ widthMM: valueInSIUnits(Number(e.target.value), 'mm', 'in') });
            }}
            fullWidth
            margin="dense"
            autoFocus
            inputRef={inputRef}
            disabled={!userContext.user}
        />
    );
};

const SteelStudSpacingInput: React.FC<SteelStudSpacingInputProps> = props => {
    const { valueInSIUnits, valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
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
                htmlInput: { step: 'any' },
            }}
            label={`Steel Stud Spacing  [${unitSystem === 'SI' ? 'mm' : 'inch'}]`}
            defaultValue={valueInCurrentUnitSystemWithDecimal(
                props.steelStudSpacing,
                'mm',
                'in',
                unitSystem === 'SI' ? 1 : 3
            )}
            onChange={e => {
                props.onSteelStudSpacingChange({
                    steelStudSpacingMM: valueInSIUnits(Number(e.target.value), 'mm', 'in'),
                });
            }}
            fullWidth
            margin="dense"
            size="small"
            inputRef={inputRef}
            disabled={!userContext.user}
        />
    );
};

const MaterialDataDisplay: React.FC<MaterialDataDisplayProps> = props => {
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();

    // Wrap valueInCurrentUnitSystemWithDecimal to allow for null or undefined values
    const convertValueOrNull = (value: number | undefined, siUnit: Unit, ipUnit: Unit, decimal: number) => {
        if (value === undefined || value === null || value === 0.0) return '--';
        return valueInCurrentUnitSystemWithDecimal(value, siUnit, ipUnit, decimal);
    };

    return (
        <Box
            sx={{
                p: 2,
                marginBottom: '25px',
                border: '1px solid #ccc',
                borderRadius: 1,
                backgroundColor: '#f9f9f9',
                marginTop: 2,
            }}
        >
            <Typography variant="h5" gutterBottom>
                Layer Segment Material:
            </Typography>
            <List dense sx={{}}>
                <ListItemText>Name: {props.selectedMaterial?.name || '--'}</ListItemText>
                <ListItemText>Category: {props.selectedMaterial?.category || '--'}</ListItemText>
                <ListItemText>
                    {unitSystem === 'SI' ? 'Conductivity [w/mk]' : 'Resistivity [R/inch]'} :{' '}
                    {convertValueOrNull(props.selectedMaterial?.conductivity_w_mk, 'w/mk', 'hr-ft2-F/btu-in', 3)}
                </ListItemText>
                <ListItemText>
                    Density {unitSystem === 'SI' ? ' [kg/m3]' : ' [lb/ft3]'} :{' '}
                    {convertValueOrNull(props.selectedMaterial?.density_kg_m3, 'kg/m3', 'lb/ft3', 1)}
                </ListItemText>
                <ListItemText>
                    Specific-Heat-Capacity {unitSystem === 'SI' ? ' [J/kg-K]' : ' [Btu/lb-F]'} :{' '}
                    {convertValueOrNull(props.selectedMaterial?.specific_heat_j_kgk, 'J/kg-K', 'Btu/lb-F', 2)}
                </ListItemText>
            </List>
        </Box>
    );
};

const MaterialInput: React.FC<MaterialInputProps> = props => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
        return (
            <FormControl fullWidth margin="dense">
                <Box>
                    <Autocomplete
                        options={props.materialOptions}
                        groupBy={option => option.category}
                        getOptionLabel={option => option.name}
                        value={props.selectedMaterial}
                        onChange={(event, newValue) => {
                            props.handleMaterialChange({
                                materialId: newValue?.id || '',
                                materialColor: newValue?.argb_color || '#ccc',
                            });
                        }}
                        disabled={!userContext.user}
                        loading={props.isLoadingMaterials}
                        renderInput={params => (
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

const OkCancelButtons: React.FC<OkCancelButtonsProps> = props => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
        return (
            <DialogActions sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                <ButtonGroup variant="text">
                    <Button onClick={props.handleModalClose} size="large" color="primary">
                        Cancel
                    </Button>
                    <Button type="submit" size="large" color="primary">
                        Save
                    </Button>
                </ButtonGroup>
            </DialogActions>
        );
    }
    return null;
};

const DeleteButton: React.FC<DeleteButtonProps> = props => {
    const userContext = useContext(UserContext);

    if (userContext.user) {
        return (
            <DialogActions sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                    color="error"
                    size="small"
                    fullWidth
                    variant="outlined"
                    disabled={!userContext.user}
                    onClick={() => {
                        const isConfirmed = window.confirm('Are you sure you want to delete this Layer Segment?');
                        if (isConfirmed) {
                            props.handleDeleteSegment(props.segmentId); // Pass the segment ID to the handler
                        }
                    }}
                >
                    Delete Segment
                </Button>
            </DialogActions>
        );
    }

    return null;
};

const ModalLayerSegment: React.FC<LayerSegmentWidthModalProps> = props => {
    const { isLoadingMaterials, materials } = useMaterials();
    const userContext = useContext(UserContext);

    // Sort materials by category
    const materialOptions = [...materials].sort((a, b) => {
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return 0;
    });

    // Find the selected material based on the materialId
    const selectedMaterial = materialOptions.find(material => material.id === props.materialId.newValue) || null;

    return (
        <Dialog open={props.isModalOpen} onClose={props.onModalClose} fullWidth maxWidth="sm">
            <DialogTitle>Segment: {selectedMaterial?.name}</DialogTitle>
            <Divider />

            <form
                onSubmit={e => {
                    e.preventDefault();
                    props.onSubmit();
                }}
            >
                <DialogContent sx={{ display: 'flex', flexDirection: 'column' }}>
                    <MaterialInput
                        materialId={props.materialId.newValue}
                        materialOptions={materialOptions}
                        selectedMaterial={selectedMaterial}
                        isLoadingMaterials={isLoadingMaterials}
                        handleMaterialChange={props.materialId.setNewValue}
                    />
                    <MaterialDataDisplay selectedMaterial={selectedMaterial} />
                    <WidthInput
                        widthMM={props.segmentWidthMM.newValue}
                        onSegmentWidthChange={props.segmentWidthMM.setNewValue}
                    />

                    <h4>Segment Attributes:</h4>
                    {/* Continuous Insulation Checkbox */}
                    {userContext.user && (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={props.continuousInsulationChecked.newValue}
                                    onChange={e => {
                                        props.continuousInsulationChecked.setNewValue({ checked: e.target.checked });
                                    }}
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
                                checked={props.steelStudChecked.newValue}
                                onChange={e => {
                                    props.steelStudChecked.setNewValue({ checked: e.target.checked });
                                }}
                                color="primary"
                                disabled={!userContext.user}
                            />
                        }
                        label="Steel Stud Layer"
                    />

                    {/* Conditionally render the steel-stud spacing input */}
                    {props.steelStudChecked.newValue && (
                        <SteelStudSpacingInput
                            steelStudSpacing={props.steelStudSpacingMM.newValue}
                            onSteelStudSpacingChange={props.steelStudSpacingMM.setNewValue}
                        />
                    )}
                </DialogContent>
                <OkCancelButtons handleModalClose={props.onModalClose} />
            </form>

            <Divider />
            <DeleteButton handleDeleteSegment={props.onDeleteSegment} segmentId={props.segmentId} />
        </Dialog>
    );
};

export default ModalLayerSegment;
