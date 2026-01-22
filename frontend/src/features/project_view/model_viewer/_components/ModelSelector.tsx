import { useState } from 'react';
import { Menu, MenuItem, Box, IconButton } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSelectedModelContext } from '../_contexts/selected_model_context';
import { LightTooltip } from '../styles/styled_components/LightTooltip';
import './ModelSelector.css';

/**
 * Formats a date string for display.
 * @param dateStr - ISO date string (e.g., "2026-01-22")
 * @returns Formatted date string (e.g., "Jan 22, 2026")
 */
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Model Selector dropdown component.
 * Allows users to switch between different HBJSON model versions.
 */
const ModelSelector: React.FC = () => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const { availableModels, selectedModelId, setSelectedModelId, isLoadingModels, triggerRefresh } =
        useSelectedModelContext();

    const handleSelect = (recordId: string | null) => {
        setSelectedModelId(recordId);
        setAnchorEl(null);
    };

    const handleRefresh = (recordId: string | null, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent MenuItem click
        triggerRefresh(recordId);
        setAnchorEl(null);
    };

    // Determine current selection label
    const getCurrentLabel = (): string => {
        if (selectedModelId === null && availableModels.length > 0) {
            return formatDate(availableModels[0].date);
        }
        const selectedModel = availableModels.find(m => m.record_id === selectedModelId);
        if (selectedModel) {
            return formatDate(selectedModel.date);
        }
        return 'Model';
    };

    // Don't render if no models or only one model
    if (availableModels.length <= 1) {
        return null;
    }

    return (
        <Box className="model-selector">
            <button
                className="model-selector-button"
                onClick={e => setAnchorEl(e.currentTarget)}
                disabled={isLoadingModels}
            >
                <span className="model-selector-label">Model Date: {getCurrentLabel()}</span>
                <KeyboardArrowDownIcon className="model-selector-arrow" fontSize="small" />
            </button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: '180px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        },
                    },
                }}
            >
                {availableModels.map((model, index) => {
                    const isLatest = index === 0;
                    const isSelected = selectedModelId === model.record_id || (selectedModelId === null && isLatest);
                    const modelId = isLatest ? null : model.record_id;

                    return (
                        <MenuItem
                            key={model.record_id}
                            onClick={() => handleSelect(modelId)}
                            selected={isSelected}
                            sx={{
                                fontSize: '0.8rem',
                                py: 0.5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span>
                                {formatDate(model.date)}
                                {isLatest && <span style={{ marginLeft: 6, opacity: 0.5 }}>(Latest)</span>}
                            </span>
                            <LightTooltip title="Refresh from AirTable" placement="right">
                                <IconButton
                                    size="small"
                                    onClick={e => handleRefresh(modelId, e)}
                                    sx={{ ml: 1, p: 0.5 }}
                                >
                                    <RefreshIcon sx={{ fontSize: '1rem', opacity: 0.6 }} />
                                </IconButton>
                            </LightTooltip>
                        </MenuItem>
                    );
                })}
            </Menu>
        </Box>
    );
};

export default ModelSelector;
