import React from 'react';
import { Switch, FormControlLabel, Tooltip } from '@mui/material';
import { useUnitSystem } from '../_contexts/UnitSystemContext';

export const UnitSystemToggle: React.FC = () => {
    const { unitSystem, toggleUnitSystem } = useUnitSystem();

    return (
        <Tooltip title={`Switch to ${unitSystem === 'SI' ? 'Imperial (IP)' : 'Metric (SI)'} units`}>
            <FormControlLabel
                control={
                    <Switch
                        size="small"
                        checked={unitSystem === 'IP'}
                        onChange={toggleUnitSystem}
                        color="primary"
                    />
                }
                label={unitSystem === 'SI' ? 'SI' : 'IP'}
            />
        </Tooltip>
    );
};