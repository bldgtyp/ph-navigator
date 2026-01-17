import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Link,
    Tooltip,
    Typography,
} from '@mui/material';

import { useManufacturerFilters } from '../../../_contexts/ManufacturerFilter.Context';

interface ManufacturerFilterModalProps {
    open: boolean;
    onClose: () => void;
}

interface ManufacturerSectionProps {
    title: string;
    available: string[];
    enabled: string[];
    locked: string[];
    setEnabled: (manufacturers: string[]) => void;
}

const ManufacturerSection: React.FC<ManufacturerSectionProps> = ({ title, available, enabled, locked, setEnabled }) => {
    const lockedSet = new Set(locked);

    const handleToggle = (manufacturer: string) => {
        if (lockedSet.has(manufacturer)) {
            return;
        }
        if (enabled.includes(manufacturer)) {
            setEnabled(enabled.filter(m => m !== manufacturer));
        } else {
            setEnabled([...enabled, manufacturer]);
        }
    };

    const handleSelectAll = () => setEnabled([...new Set([...available, ...locked])]);
    const handleSelectNone = () => setEnabled([...locked]);

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                    {title}
                </Typography>
                <Box>
                    <Link component="button" variant="body2" onClick={handleSelectAll} sx={{ mr: 2 }}>
                        Select All
                    </Link>
                    <Link component="button" variant="body2" onClick={handleSelectNone}>
                        Select None
                    </Link>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', pl: 1 }}>
                {available.map(manufacturer => {
                    const isLocked = lockedSet.has(manufacturer);
                    return (
                        <Tooltip
                            key={manufacturer}
                            title={isLocked ? 'In use on window elements' : ''}
                            placement="right"
                            arrow
                            disableHoverListener={!isLocked}
                        >
                            <span>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={enabled.includes(manufacturer)}
                                            onChange={() => handleToggle(manufacturer)}
                                            size="small"
                                            disabled={isLocked}
                                        />
                                    }
                                    label={manufacturer}
                                    disabled={isLocked}
                                    sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
                                />
                            </span>
                        </Tooltip>
                    );
                })}
            </Box>
        </Box>
    );
};

export const ManufacturerFilterModal: React.FC<ManufacturerFilterModalProps> = ({ open, onClose }) => {
    const { filterConfig, updateFilters, isLoading, refreshFilters } = useManufacturerFilters();

    const [enabledFrames, setEnabledFrames] = useState<string[]>([]);
    const [enabledGlazings, setEnabledGlazings] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (filterConfig) {
            setEnabledFrames([...filterConfig.enabled_frame_manufacturers]);
            setEnabledGlazings([...filterConfig.enabled_glazing_manufacturers]);
        }
    }, [filterConfig, open]);

    useEffect(() => {
        if (open) {
            refreshFilters();
        }
    }, [open, refreshFilters]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateFilters(enabledFrames, enabledGlazings);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (filterConfig) {
            setEnabledFrames([...filterConfig.enabled_frame_manufacturers]);
            setEnabledGlazings([...filterConfig.enabled_glazing_manufacturers]);
        }
        onClose();
    };

    if (!filterConfig) {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogContent>
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={handleCancel} maxWidth="sm" fullWidth>
            <DialogTitle>Configure Manufacturer Filters</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Select which manufacturers to show in the frame and glazing type dropdowns. Unchecked manufacturers
                    will be hidden from selection.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Manufacturers in use can’t be disabled.
                </Typography>

                <ManufacturerSection
                    title="Frame Manufacturers"
                    available={filterConfig.available_frame_manufacturers}
                    enabled={enabledFrames}
                    locked={filterConfig.used_frame_manufacturers ?? []}
                    setEnabled={setEnabledFrames}
                />

                <Divider sx={{ my: 2 }} />

                <ManufacturerSection
                    title="Glazing Manufacturers"
                    available={filterConfig.available_glazing_manufacturers}
                    enabled={enabledGlazings}
                    locked={filterConfig.used_glazing_manufacturers ?? []}
                    setEnabled={setEnabledGlazings}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} disabled={isSaving}>
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={isSaving || isLoading}>
                    {isSaving ? <CircularProgress size={20} /> : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
