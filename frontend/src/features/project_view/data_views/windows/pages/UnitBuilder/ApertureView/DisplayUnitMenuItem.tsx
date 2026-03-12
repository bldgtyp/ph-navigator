import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import StraightenIcon from '@mui/icons-material/Straighten';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckIcon from '@mui/icons-material/Check';
import { useState } from 'react';

import { useUnitSystem } from '../../../../../_contexts/UnitSystemContext';
import { useDisplayUnit } from '../Dimensions/DisplayUnit.Context';

import type { IPDisplayUnit, SIDisplayUnit } from '../Dimensions/types';

interface UnitOption<T> {
    value: T;
    label: string;
}

const SI_OPTIONS: UnitOption<SIDisplayUnit>[] = [
    { value: 'mm', label: 'Millimeters (mm)' },
    { value: 'cm', label: 'Centimeters (cm)' },
    { value: 'm', label: 'Meters (m)' },
];

const IP_OPTIONS: UnitOption<IPDisplayUnit>[] = [
    { value: 'in', label: 'Inches (in)' },
    { value: 'ft', label: 'Feet - decimal (ft)' },
    { value: 'ft-in', label: 'Feet & Inches (ft-in)' },
];

interface DisplayUnitMenuItemProps {
    onCloseParent: () => void;
}

export const DisplayUnitMenuItem: React.FC<DisplayUnitMenuItemProps> = ({ onCloseParent }) => {
    const { unitSystem } = useUnitSystem();
    const { activeDisplayUnit, setSIDisplayUnit, setIPDisplayUnit } = useDisplayUnit();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (value: string) => {
        if (unitSystem === 'SI') {
            setSIDisplayUnit(value as SIDisplayUnit);
        } else {
            setIPDisplayUnit(value as IPDisplayUnit);
        }
        handleClose();
        onCloseParent();
    };

    const options = unitSystem === 'SI' ? SI_OPTIONS : IP_OPTIONS;

    return (
        <>
            <MenuItem onClick={handleOpen}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                    <StraightenIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Dimension units" secondary={activeDisplayUnit} />
                <ChevronRightIcon fontSize="small" sx={{ ml: 1, color: 'text.secondary' }} />
            </MenuItem>

            <Menu
                anchorEl={anchorEl}
                open={isOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                {options.map(option => (
                    <MenuItem
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                        selected={option.value === activeDisplayUnit}
                    >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                            {option.value === activeDisplayUnit ? <CheckIcon fontSize="small" /> : null}
                        </ListItemIcon>
                        <ListItemText primary={option.label} />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};
