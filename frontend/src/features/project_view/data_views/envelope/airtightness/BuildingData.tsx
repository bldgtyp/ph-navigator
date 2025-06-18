import { Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { subTitleStyle } from './BlowerDoorTest.Style';
import { FormNameStyle, FormValueSx } from './BuildingData.Styles';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getWithAlert } from '../../../../../api/getWithAlert';
import LoadingModal from '../../_components/LoadingModal';

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

const BuildingDataFormItem: React.FC<{ name: string; value: number }> = ({ name, value }) => {
    return (
        <Grid container>
            <Grid size={3}>
                <Typography sx={FormValueSx} style={FormNameStyle}>
                    {name}:
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
    const [isLoadingAirtightnessData, setIsLoadingAirtightnessData] = useState(false);
    const [airtightnessData, setAirtightnessData] = useState(defaultAirtightnessData);

    useEffect(() => {
        const fetchAirtightnessData = async () => {
            console.log('fetchAssemblies', projectId);
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
                    value={airtightnessData.floor_area_m2}
                />
                <BuildingDataFormItem name="Net Interior Volume (Vn50)" value={airtightnessData.net_volume_m3} />
                <BuildingDataFormItem name="Exterior Envelope Area" value={airtightnessData.envelope_area_m2} />
                <BuildingDataFormItem name="Target n50 @50Pa" value={airtightnessData.n_50_ACH} />
                <BuildingDataFormItem name="Target q50 @50Pa" value={airtightnessData.q_50_m3_hr_m2} />
                <BuildingDataFormItem name="Target Air Leakage @50Pa" value={airtightnessData.air_leakage_m3_hr} />
            </Stack>
        </Box>
    );
};

export default BuildingData;
