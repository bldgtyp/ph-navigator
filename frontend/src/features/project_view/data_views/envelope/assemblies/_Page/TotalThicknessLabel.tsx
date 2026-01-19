import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

import { useAssemblyContext } from '../Assembly/Assembly.Context';
import { useUnitConversion } from '../../../../_hooks/useUnitConversion';

const TotalThicknessLabel: React.FC = () => {
    const { selectedAssembly, layerThicknessOverridesMm } = useAssemblyContext();
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    const totalThicknessMm = useMemo(() => {
        if (!selectedAssembly) {
            return 0;
        }

        const sumMm = selectedAssembly.layers.reduce((acc, layer) => {
            const override = layerThicknessOverridesMm[layer.id];
            const thickness = typeof override === 'number' ? override : layer.thickness_mm;
            return acc + thickness;
        }, 0);

        return Number.isFinite(sumMm) ? sumMm : 0;
    }, [selectedAssembly, layerThicknessOverridesMm]);

    const decimals = unitSystem === 'SI' ? 3 : 1;
    const unitLabel = unitSystem === 'SI' ? 'mm' : 'in';
    const formattedValue = valueInCurrentUnitSystemWithDecimal(totalThicknessMm, 'mm', 'in', decimals);

    if (!selectedAssembly) {
        return null;
    }

    return (
        <Tooltip title="Sum of all layer thicknesses" placement="top" arrow>
            <Box
                sx={{
                    px: 1,
                    py: 0.25,
                    display: 'flex',
                    alignItems: 'center',
                    height: '100%',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Total Thickness: {formattedValue} {unitLabel}
                </Typography>
            </Box>
        </Tooltip>
    );
};

export default TotalThicknessLabel;
