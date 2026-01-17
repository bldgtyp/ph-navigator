import { useContext } from 'react';
import type { FC, ReactNode } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ColorizeIcon from '@mui/icons-material/Colorize';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ClearIcon from '@mui/icons-material/Clear';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';

import { useZoom } from './Zoom.Context';
import { useViewDirection } from './ViewDirection.Context';
import { useCopyPaste } from './CopyPaste.Context';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';

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

const ToolbarDivider: FC = () => {
    return (
        <Box
            sx={{
                width: '1px',
                height: '14px',
                backgroundColor: 'var(--outline-color)',
                mx: 0.75,
            }}
        />
    );
};

const ApertureToolbar: FC = () => {
    const userContext = useContext(UserContext);
    const { zoomIn, zoomOut, scaleFactor } = useZoom();
    const { isInsideView, toggleViewDirection } = useViewDirection();
    const { isPickMode, isPasteMode, startPickMode, resetPasteMode } = useCopyPaste();
    const {
        activeAperture,
        selectedApertureElementIds,
        mergeSelectedApertureElements,
        splitSelectedApertureElement,
        clearApertureElementIdSelection,
        handleAddRow,
        handleAddColumn,
    } = useApertures();

    const isZoomInDisabled = scaleFactor >= 1.0;
    const isZoomOutDisabled = scaleFactor <= 0.05;
    const isMergeDisabled = selectedApertureElementIds.length < 2;
    const isSplitDisabled = selectedApertureElementIds.length !== 1;
    const isClearDisabled = selectedApertureElementIds.length === 0;
    const isGridDisabled = !activeAperture;
    const isCopyDisabled = !userContext.user || !activeAperture;

    const mergeTooltip = isMergeDisabled
        ? 'Select 2+ elements to merge'
        : `Merge selected (${selectedApertureElementIds.length} elements)`;
    const splitTooltip = isSplitDisabled ? 'Select 1 element to split' : 'Split selected element';
    const clearTooltip = isClearDisabled ? 'Select elements to clear' : 'Clear selection';
    const viewLabel = isInsideView ? 'Viewing from Interior' : 'Viewing from Exterior';
    const viewTooltip = isInsideView ? 'Switch to exterior view' : 'Switch to interior view';
    const copyPasteTooltip = isPasteMode
        ? 'Exit paste mode'
        : isPickMode
          ? 'Click a window element to copy assignments'
          : 'Pick a window element to copy assignments';

    const handleCopyPasteClick = () => {
        if (isPasteMode || isPickMode) {
            resetPasteMode();
            return;
        }

        startPickMode();
        clearApertureElementIdSelection();
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
                    icon={<ZoomInIcon fontSize="small" />}
                    onClick={zoomIn}
                    disabled={isZoomInDisabled}
                    tooltipText="Zoom in"
                />
                <ToolbarIconButton
                    icon={<ZoomOutIcon fontSize="small" />}
                    onClick={zoomOut}
                    disabled={isZoomOutDisabled}
                    tooltipText="Zoom out"
                />
                <ToolbarIconButton
                    icon={<SwapHorizIcon fontSize="small" />}
                    onClick={toggleViewDirection}
                    tooltipText={viewTooltip}
                />
                <Box
                    component="span"
                    sx={{
                        ml: 0.25,
                        mr: 0.5,
                        px: 0.5,
                        py: '1px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: '1px solid var(--outline-color)',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary-color)',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                    }}
                >
                    {viewLabel}
                </Box>

                {userContext.user && (
                    <>
                        <ToolbarDivider />
                        <ToolbarIconButton
                            icon={
                                isPasteMode ? (
                                    <FormatColorFillIcon fontSize="small" />
                                ) : (
                                    <ColorizeIcon fontSize="small" />
                                )
                            }
                            onClick={handleCopyPasteClick}
                            disabled={isCopyDisabled}
                            tooltipText={copyPasteTooltip}
                        />
                        {isPickMode && !isPasteMode && (
                            <Box
                                component="span"
                                sx={{
                                    ml: 0.25,
                                    mr: 0.5,
                                    px: 0.5,
                                    py: '1px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(129, 199, 132, 0.18)',
                                    border: '1px solid rgba(76, 175, 80, 0.5)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary-color)',
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                }}
                            >
                                Pick source
                            </Box>
                        )}
                        {isPasteMode && (
                            <Box
                                component="span"
                                sx={{
                                    ml: 0.25,
                                    mr: 0.5,
                                    px: 0.5,
                                    py: '1px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(255, 217, 102, 0.25)',
                                    border: '1px solid rgba(255, 193, 7, 0.6)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary-color)',
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                }}
                            >
                                Paste mode
                            </Box>
                        )}
                        <ToolbarIconButton
                            icon={<CallMergeIcon fontSize="small" />}
                            onClick={mergeSelectedApertureElements}
                            disabled={isMergeDisabled}
                            tooltipText={mergeTooltip}
                        />
                        <ToolbarIconButton
                            icon={<CallSplitIcon fontSize="small" />}
                            onClick={splitSelectedApertureElement}
                            disabled={isSplitDisabled}
                            tooltipText={splitTooltip}
                        />
                        <ToolbarIconButton
                            icon={<ClearIcon fontSize="small" />}
                            onClick={clearApertureElementIdSelection}
                            disabled={isClearDisabled}
                            tooltipText={clearTooltip}
                        />
                        <ToolbarDivider />
                        <ToolbarIconButton
                            icon={<ViewColumnOutlinedIcon fontSize="small" />}
                            onClick={handleAddColumn}
                            disabled={isGridDisabled}
                            tooltipText="Add column"
                        />
                        <ToolbarIconButton
                            icon={<TableRowsOutlinedIcon fontSize="small" />}
                            onClick={handleAddRow}
                            disabled={isGridDisabled}
                            tooltipText="Add row"
                        />
                    </>
                )}
            </Box>
        </Box>
    );
};

export default ApertureToolbar;
