import { Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { subTitleStyle } from './BlowerDoorTest.Styles';
import { FormNameStyle, FormValueSx } from './BuildingData.Styles';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getWithAlert } from '../../../../../api/getWithAlert';
import LoadingModal from '../../_components/LoadingModal';
import { useUnitConversion } from '../../../_hooks/useUnitConversion';

interface AirtightnessDataType {
    floor_area_m2: number;
    envelope_area_m2: number;
    net_volume_m3: number;
    n_50_ACH: number;
    q_50_m3_hr_m2: number;
    air_leakage_m3_hr: number;
}

const defaultAirtightnessData: AirtightnessDataType = {
    floor_area_m2: 0,
    envelope_area_m2: 0,
    net_volume_m3: 0,
    n_50_ACH: 0,
    q_50_m3_hr_m2: 0,
    air_leakage_m3_hr: 0,
};

const BuildingDataFormItem: React.FC<{ name: string; unit: string; value: string }> = ({ name, unit, value }) => {
    return (
        <Grid container>
            <Grid size={3}>
                <Typography sx={FormValueSx} style={FormNameStyle}>
                    {name} [{unit}]:
                </Typography>
            </Grid>
            <Grid size={9}>
                <TextField value={value} disabled={true} fullWidth size="small" />
            </Grid>
        </Grid>
    );
};

const BuildingData: React.FC = () => {
    const { projectId } = useParams();
    const { valueInCurrentUnitSystemWithDecimal, valueInSIUnits, unitSystem } = useUnitConversion();
    const [isLoadingAirtightnessData, setIsLoadingAirtightnessData] = useState(false);
    const [airtightnessData, setAirtightnessData] = useState(defaultAirtightnessData);

    useEffect(() => {
        const fetchAirtightnessData = async () => {
            setIsLoadingAirtightnessData(true);
            try {
                const response = await getWithAlert<AirtightnessDataType>(
                    `airtightness/get-airtightness-data/${projectId}`
                );
                if (response) {
                    setAirtightnessData(response);
                }
            } catch (error) {
                console.error('Failed to fetch airtightness data:', error);
                return [];
            } finally {
                setIsLoadingAirtightnessData(false);
            }
        };
        fetchAirtightnessData();
    }, [projectId]);

    return (
        <Box sx={{ margin: 2 }}>
            <LoadingModal showModal={isLoadingAirtightnessData} />

            <Stack spacing={1}>
                <Typography style={subTitleStyle}>
                    The data provided below is to be used during the blower-door test in order to determine the total
                    air-leakage rate (n50 / q50).
                </Typography>
                <BuildingDataFormItem
                    name="Net Interior Floor Area (iCFA/TFA)"
                    unit={unitSystem === 'SI' ? 'm2' : 'ft2'}
                    value={valueInCurrentUnitSystemWithDecimal(airtightnessData.floor_area_m2, 'm2', 'ft2', 1)}
                />
                <BuildingDataFormItem
                    name="Net Interior Volume (Vn50)"
                    unit={unitSystem === 'SI' ? 'm3' : 'ft3'}
                    value={valueInCurrentUnitSystemWithDecimal(airtightnessData.net_volume_m3, 'm3', 'ft3', 1)}
                />
                <BuildingDataFormItem
                    name="Exterior Envelope Area"
                    unit={unitSystem === 'SI' ? 'm2' : 'ft2'}
                    value={valueInCurrentUnitSystemWithDecimal(airtightnessData.envelope_area_m2, 'm2', 'ft2', 1)}
                />
                <BuildingDataFormItem name="Target n50 @50Pa" unit="ACH" value={airtightnessData.n_50_ACH.toFixed(2)} />
                <BuildingDataFormItem
                    name="Target q50 @50Pa"
                    unit={unitSystem === 'SI' ? 'm3/hr-m2' : 'cfm/ft2'}
                    value={valueInCurrentUnitSystemWithDecimal(
                        airtightnessData.q_50_m3_hr_m2,
                        'm3_hr_m2',
                        'cfm_ft2',
                        3
                    )}
                />
                <BuildingDataFormItem
                    name="Target Air Leakage @50Pa"
                    unit={unitSystem === 'SI' ? 'm3/hr' : 'cfm'}
                    value={valueInCurrentUnitSystemWithDecimal(airtightnessData.air_leakage_m3_hr, 'm3_hr', 'cfm', 0)}
                />
            </Stack>
        </Box>
    );
};

export default BuildingData;
