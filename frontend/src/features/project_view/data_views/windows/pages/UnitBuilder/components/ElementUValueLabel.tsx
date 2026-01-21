import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';

interface ElementUValueLabelProps {
    uValue: number | null;
    loading: boolean;
}

const TOOLTIP_CONTENT = (
    <Box sx={{ maxWidth: 250 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Element U-Value (U-w)
        </Typography>
        <Typography variant="body2">Calculated per ISO 10077-1:2006</Typography>
    </Box>
);

// Compact container style for element-level display
const containerStyle = {
    px: 0.75,
    py: 0.25,
    display: 'flex',
    alignItems: 'center',
    minWidth: 120,
};

/**
 * Compact U-value label for individual window elements.
 * Based on UValueLabel but with smaller styling for space-constrained areas.
 * Respects the SI/IP unit system toggle.
 */
const ElementUValueLabel: React.FC<ElementUValueLabelProps> = ({ uValue, loading }) => {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    // Format display value based on unit system
    const displayContent = useMemo(() => {
        if (uValue === null) {
            return null;
        }

        if (unitSystem === 'IP') {
            const uValueIP = valueInCurrentUnitSystemWithDecimal(uValue, 'w/m2k', 'btu/hr-ft2-F', 3);
            return {
                value: uValueIP,
                unit: 'BTU/hr-ft²-°F',
            };
        } else {
            return {
                value: uValue.toFixed(3),
                unit: 'W/m²K',
            };
        }
    }, [uValue, unitSystem, valueInCurrentUnitSystemWithDecimal]);

    // Reserve space but show nothing until value is calculated (prevents UI bounce)
    if (loading) {
        return <Box sx={containerStyle} />;
    }

    // Show nothing if no data
    if (!displayContent) {
        return <Box sx={containerStyle} />;
    }

    return (
        <Tooltip title={TOOLTIP_CONTENT} placement="top" arrow>
            <Box
                sx={{
                    ...containerStyle,
                    cursor: 'help',
                }}
            >
                <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}>
                    U-w: {displayContent.value} {displayContent.unit}
                </Typography>
            </Box>
        </Tooltip>
    );
};

export default ElementUValueLabel;
