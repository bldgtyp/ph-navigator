import { useContext } from 'react';
import type { FC, ReactNode } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import FlipIcon from '@mui/icons-material/Flip';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useAssemblyContext } from './Assembly.Context';

interface ToolbarIconButtonProps {
    icon: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    tooltipText: string;
}

const ToolbarIconButton: FC<ToolbarIconButtonProps> = ({ icon, onClick, disabled = false, tooltipText }) => {
    return (
        <Tooltip title={tooltipText} placement="top" arrow enterDelay={300}>
            <span>
                <IconButton
                    onClick={onClick}
                    disabled={disabled}
                    size="small"
                    sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '4px',
                        transition: 'transform 150ms ease-out, background-color 150ms ease-out',
                        '&:hover': disabled
                            ? undefined
                            : {
                                  backgroundColor: 'rgba(25, 118, 210, 0.12)',
                                  transform: 'scale(1.05)',
                              },
                        '&:active': disabled
                            ? undefined
                            : {
                                  transform: 'scale(0.95)',
                              },
                        '&.Mui-disabled': {
                            opacity: 0.4,
                            cursor: 'not-allowed',
                        },
                    }}
                    aria-label={tooltipText}
                >
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );
};

const AssemblyToolbar: FC = () => {
    const userContext = useContext(UserContext);
    const { selectedAssemblyId, handleFlipOrientation, handleFlipLayers } = useAssemblyContext();

    // Hide toolbar entirely for guests
    if (!userContext.user) {
        return null;
    }

    const isDisabled = !selectedAssemblyId;
    const flipOrientationTooltip = isDisabled
        ? 'Select an assembly to flip orientation'
        : 'Flip interior/exterior orientation';
    const flipLayersTooltip = isDisabled
        ? 'Select an assembly to flip layers'
        : 'Reverse layers from inside to outside';

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.75,
                    py: '2px',
                    backgroundColor: 'var(--appbar-bg-color)',
                    border: '1px solid var(--outline-color)',
                    borderRadius: '6px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    maxWidth: '100%',
                    flexWrap: 'wrap',
                }}
            >
                <ToolbarIconButton
                    icon={<SwapVertIcon fontSize="small" />}
                    onClick={() => {
                        if (!selectedAssemblyId) return;
                        handleFlipOrientation(selectedAssemblyId);
                    }}
                    disabled={isDisabled}
                    tooltipText={flipOrientationTooltip}
                />
                <ToolbarIconButton
                    icon={<FlipIcon fontSize="small" />}
                    onClick={() => {
                        if (!selectedAssemblyId) return;
                        handleFlipLayers(selectedAssemblyId);
                    }}
                    disabled={isDisabled}
                    tooltipText={flipLayersTooltip}
                />
            </Box>
        </Box>
    );
};

export default AssemblyToolbar;
