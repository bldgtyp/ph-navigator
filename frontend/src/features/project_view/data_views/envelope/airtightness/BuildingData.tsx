import { Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { subTitleStyle } from './BlowerDoorTest.Style';

const FormNameStyle = {
    fontSize: '0.9rem',
    fontWeight: '700',
    justifySelf: 'right',
    height: '100%',
    p: 1,
};

const FormValueSx = {
    pr: 1,
    alignItems: 'center',
    display: 'flex',
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
                <TextField defaultValue={value} disabled={true} fullWidth size="small">
                    {value}
                </TextField>
            </Grid>
        </Grid>
    );
};

const BuildingData: React.FC = () => (
    <Box sx={{ margin: 2 }}>
        <Stack spacing={1}>
            <Typography style={subTitleStyle}>
                The data provided below is to be used during the blower-door test in order to determine the total
                air-leakage rate (n50 / q50).
            </Typography>
            <BuildingDataFormItem name="Net Interior Floor Area (iCFA/TFA)" value={1245} />
            <BuildingDataFormItem name="Net Interior Volume (Vn50)" value={1245} />
            <BuildingDataFormItem name="Exterior Envelope Area" value={1245} />
            <BuildingDataFormItem name="Target n50 @50Pa" value={0.6} />
            <BuildingDataFormItem name="Target q50 @50Pa" value={0.06} />
            <BuildingDataFormItem name="Target Air Leakage @50Pa" value={0.6} />
        </Stack>
    </Box>
);

export default BuildingData;
