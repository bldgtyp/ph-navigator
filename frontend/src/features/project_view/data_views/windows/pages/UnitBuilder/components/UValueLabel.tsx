import React, { useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useUnitConversion } from '../../../../../_hooks/useUnitConversion';

interface UValueLabelProps {
    uValue: number | null;
    loading: boolean;
    error: string | null;
    isValid?: boolean;
}

const TOOLTIP_CONTENT = (
    <Box sx={{ maxWidth: 300 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Effective Window U-Value (U-w)
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
            Calculated per ISO 10077-1:2006
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
            {'U'}
            <sub>w</sub>
            {' = (A'}
            <sub>g</sub>
            {'·U'}
            <sub>g</sub>
            {' + A'}
            <sub>f</sub>
            {'·U'}
            <sub>f</sub>
            {' + l'}
            <sub>g</sub>
            {'·Ψ'}
            <sub>g</sub>
            {') / A'}
            <sub>w</sub>
        </Typography>
        <Typography variant="body2">Uninstalled value (excludes Ψ-install)</Typography>
    </Box>
);

// Fixed container style to prevent layout shifts
const containerStyle = {
    px: 1,
    py: 0.25,
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    minWidth: 180,
};

/**
 * Displays the window U-value with a tooltip explaining the calculation method.
 * Styled to match the assembly EffectiveRValueLabel component.
 * Respects the SI/IP unit system toggle.
 */
const UValueLabel: React.FC<UValueLabelProps> = ({ uValue, loading, error, isValid = true }) => {
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    // Format display value based on unit system
    const displayContent = useMemo(() => {
        if (uValue === null) {
            return null;
        }

        if (unitSystem === 'IP') {
            // Show U-value in IP units (BTU/hr-ft²-°F)
            const uValueIP = valueInCurrentUnitSystemWithDecimal(uValue, 'w/m2k', 'btu/hr-ft2-F', 3);
            return {
                value: uValueIP,
                unit: 'BTU/hr-ft²-°F',
            };
        } else {
            // Show U-value in SI units (W/m²K)
            return {
                value: uValue.toFixed(3),
                unit: 'W/m²K',
            };
        }
    }, [uValue, unitSystem, valueInCurrentUnitSystemWithDecimal]);

    // Reserve space but show nothing until value is calculated (prevents UI bounce)
    if (loading) {
        return <Box id="window-u-value-label" sx={containerStyle} />;
    }

    // Show nothing if error or invalid data
    if ((error && !isValid) || !displayContent) {
        return <Box id="window-u-value-label" sx={containerStyle} />;
    }

    return (
        <Tooltip title={TOOLTIP_CONTENT} placement="top" arrow>
            <Box
                id="window-u-value-label"
                sx={{
                    ...containerStyle,
                    cursor: 'help',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    U-w: {displayContent.value} {displayContent.unit}
                </Typography>
                <InfoOutlinedIcon sx={{ ml: 0.5, fontSize: 14, color: 'text.secondary' }} />
            </Box>
        </Tooltip>
    );
};

export default UValueLabel;
