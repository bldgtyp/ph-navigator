import React, { useEffect, useState, useMemo } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { useAssemblyContext } from '../Assembly/Assembly.Context';
import { useUnitConversion } from '../../../../_hooks/useUnitConversion';
import { getWithAlert } from '../../../../../../api/getWithAlert';

/**
 * Response schema for thermal resistance calculation from the API.
 * All R-values are in SI units: m2-K/W
 * U-value is in SI units: W/m2-K
 */
interface ThermalResistanceResponse {
    r_parallel_path_si: number;
    r_isothermal_planes_si: number;
    r_effective_si: number;
    u_effective_si: number;
    is_valid: boolean;
    warnings: string[];
}

const TOOLTIP_CONTENT = (
    <Box sx={{ maxWidth: 300 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Effective Thermal Resistance
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
            Calculated using the Passive House method: the average of the Parallel-Path and Isothermal-Planes methods.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
            Note: Surface film resistances (air films) are NOT included in the value shown here.
        </Typography>
        <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
            Reference: ASHRAE Handbook - Fundamentals, Chapter 27
        </Typography>
    </Box>
);

/**
 * Displays the effective R-Value (IP) or U-Value (SI) of the selected assembly.
 *
 * The calculation is performed on the backend using the Passive House method,
 * which averages the Parallel-Path and Isothermal-Planes methods from
 * ASHRAE Handbook Chapter 27.
 */
// Fixed container style to prevent layout shifts
const containerStyle = {
    px: 1,
    py: 0.25,
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    minWidth: 180, // Reserve space to prevent layout shifts
};

const EffectiveRValueLabel: React.FC = () => {
    const { selectedAssembly, rValueRefreshKey } = useAssemblyContext();
    const { unitSystem, valueInCurrentUnitSystemWithDecimal } = useUnitConversion();

    const [thermalData, setThermalData] = useState<ThermalResistanceResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch thermal resistance data when assembly changes
    useEffect(() => {
        if (!selectedAssembly) {
            setThermalData(null);
            setError(null);
            return;
        }

        const fetchThermalResistance = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await getWithAlert<ThermalResistanceResponse>(
                    `assembly/thermal-resistance/${selectedAssembly.id}`
                );

                if (response) {
                    setThermalData(response);
                } else {
                    setThermalData(null);
                }
            } catch (err) {
                console.error('Failed to fetch thermal resistance:', err);
                setError('Failed to calculate');
                setThermalData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchThermalResistance();
    }, [selectedAssembly, rValueRefreshKey]);

    // Format display value based on unit system
    const displayContent = useMemo(() => {
        if (!thermalData || !thermalData.is_valid) {
            return null;
        }

        if (unitSystem === 'IP') {
            // Show R-value in IP units (hr-ft2-F/BTU)
            const rValueIP = valueInCurrentUnitSystemWithDecimal(
                thermalData.r_effective_si,
                'm2k/w',
                'hr-ft2-F/btu',
                1
            );
            return {
                label: 'R',
                value: rValueIP,
                unit: '', // R-values typically shown without unit in IP
            };
        } else {
            // Show U-value in SI units (W/m2-K)
            return {
                label: 'U',
                value: thermalData.u_effective_si.toFixed(3),
                unit: 'W/m\u00B2K',
            };
        }
    }, [thermalData, unitSystem, valueInCurrentUnitSystemWithDecimal]);

    // Reserve space but show nothing until value is calculated
    if (!selectedAssembly || isLoading) {
        return <Box id="assembly-effective-r-value-label" sx={containerStyle} />;
    }

    // Show nothing if error or invalid data (no valid value to display)
    if (error || !displayContent) {
        return <Box id="assembly-effective-r-value-label" sx={containerStyle} />;
    }

    return (
        <Tooltip title={TOOLTIP_CONTENT} placement="top" arrow>
            <Box
                id="assembly-effective-r-value-label"
                sx={{
                    ...containerStyle,
                    cursor: 'help',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Effective {displayContent.label}-Value: {displayContent.value}
                    {displayContent.unit && ` ${displayContent.unit}`}
                </Typography>
                <InfoOutlinedIcon sx={{ ml: 0.5, fontSize: 14, color: 'text.secondary' }} />
            </Box>
        </Tooltip>
    );
};

export default EffectiveRValueLabel;
