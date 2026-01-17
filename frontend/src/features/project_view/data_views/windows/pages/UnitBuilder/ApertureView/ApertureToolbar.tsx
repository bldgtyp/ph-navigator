import { useContext } from 'react';
import type { FC, ReactNode } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ClearIcon from '@mui/icons-material/Clear';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';

import { useZoom } from './Zoom.Context';
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
                                  backgroundColor: 'var(--highlight-light-color)',
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

    const mergeTooltip = isMergeDisabled
        ? 'Select 2+ elements to merge'
        : `Merge selected (${selectedApertureElementIds.length} elements)`;
    const splitTooltip = isSplitDisabled ? 'Select 1 element to split' : 'Split selected element';
    const clearTooltip = isClearDisabled ? 'Select elements to clear' : 'Clear selection';

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

                {userContext.user && (
                    <>
                        <ToolbarDivider />
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
