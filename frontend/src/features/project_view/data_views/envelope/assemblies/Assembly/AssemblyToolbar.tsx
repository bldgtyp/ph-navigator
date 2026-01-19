import { useContext } from 'react';
import type { FC, ReactNode } from 'react';
import { Box, Chip, Divider, IconButton, Tooltip } from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import FlipIcon from '@mui/icons-material/Flip';
import ColorizeIcon from '@mui/icons-material/Colorize';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import UndoIcon from '@mui/icons-material/Undo';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useAssemblyContext } from './Assembly.Context';
import { useCopyPaste } from './CopyPaste.Context';

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
    const { isPickMode, isPasteMode, startPickMode, resetPasteMode, undoLastPaste, undoStack } = useCopyPaste();

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

    // Copy/paste tooltip and click handler
    const copyPasteTooltip = isPasteMode
        ? 'Exit paste mode'
        : isPickMode
          ? 'Click a segment to copy material'
          : 'Copy/Paste segment material';

    const handleCopyPasteClick = () => {
        if (isPasteMode || isPickMode) {
            resetPasteMode();
            return;
        }
        startPickMode();
    };

    // Undo tooltip
    const undoTooltip =
        isPickMode || isPasteMode
            ? 'Exit paste mode to undo'
            : undoStack.length === 0
              ? 'No paste operations to undo'
              : `Undo last material paste (${undoStack.length})`;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, alignItems: 'center', gap: 1 }}>
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

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                <ToolbarIconButton
                    icon={isPasteMode ? <FormatColorFillIcon fontSize="small" /> : <ColorizeIcon fontSize="small" />}
                    onClick={handleCopyPasteClick}
                    disabled={isDisabled}
                    tooltipText={copyPasteTooltip}
                />
                <ToolbarIconButton
                    icon={<UndoIcon fontSize="small" />}
                    onClick={undoLastPaste}
                    disabled={isDisabled || undoStack.length === 0 || isPickMode || isPasteMode}
                    tooltipText={undoTooltip}
                />
            </Box>

            {/* Mode status badges */}
            {isPickMode && (
                <Chip
                    label="Pick source"
                    size="small"
                    sx={{
                        backgroundColor: 'rgba(129, 199, 132, 0.18)',
                        color: 'rgba(56, 142, 60, 1)',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                    }}
                />
            )}
            {isPasteMode && (
                <Chip
                    label="Paste mode"
                    size="small"
                    sx={{
                        backgroundColor: 'rgba(255, 217, 102, 0.25)',
                        color: 'rgba(245, 124, 0, 1)',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                    }}
                />
            )}
        </Box>
    );
};

export default AssemblyToolbar;
