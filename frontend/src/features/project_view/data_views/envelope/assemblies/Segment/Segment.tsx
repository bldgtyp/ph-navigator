import { useContext } from 'react';
import { Box, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useCopyPaste } from '../Assembly/CopyPaste.Context';

import SegmentPropertiesModal from '../SegmentPropertiesModal/LayerSegmentProperties';
import { SegmentType } from '../../_types/Segment';
import { useLayerSegmentHooks } from './Segment.Hooks';

// Custom cursor SVG data URIs (matching Window Unit Builder style)
const PICK_CURSOR = [
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23000'>",
    "<path d='m20.71 5.63-2.34-2.34a.996.996 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 ",
    '1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 ',
    "3.12-3.12c.4-.4.4-1.03.01-1.42M6.92 19 5 17.08l8.06-8.06 1.92 1.92z'/>",
    '</svg>") 4 20, copy',
].join('');

const PASTE_CURSOR = [
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23000'>",
    "<path d='M16.56 8.94 7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 ",
    '0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 ',
    '0-2.12M5.21 10 10 5.21 14.79 10zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 ',
    "2-2c0-1.33-2-3.5-2-3.5M2 20h20v4H2z'/>",
    '</svg>") 6 22, copy',
].join('');

type SegmentProps = {
    segment: SegmentType;
    onAddSegmentLeft: (segment: SegmentType) => void;
    onAddSegmentRight: (segment: SegmentType) => void;
    onDeleteSegment: (segmentId: number) => void;
    onSegmentUpdated?: (segment: SegmentType) => void;
};

type SegmentPosition = 'left' | 'right';

interface AddSegmentButtonProps {
    position: SegmentPosition;
    onClick: () => void;
}

const AddSegmentButton: React.FC<AddSegmentButtonProps> = ({ position, onClick }) => {
    const tooltipText = position === 'left' ? 'Add Segment Before' : 'Add Segment After';
    const className = `create-new-segment-button create-new-segment-button-${position}`;
    const placement = position === 'left' ? 'left' : 'right';

    return (
        <Tooltip title={tooltipText} placement={placement}>
            <button
                className={className}
                onClick={event => {
                    event.stopPropagation();
                    onClick();
                }}
            >
                +
            </button>
        </Tooltip>
    );
};

const Segment: React.FC<SegmentProps> = ({
    segment,
    onAddSegmentLeft,
    onAddSegmentRight,
    onDeleteSegment,
    onSegmentUpdated,
}) => {
    const userContext = useContext(UserContext);
    const hooks = useLayerSegmentHooks(segment);
    const { isPickMode, isPasteMode, startPasteMode, pasteToSegment, lastPastedSegmentId, sourceSegmentId } =
        useCopyPaste();

    const isSourceSegment = sourceSegmentId === segment.id;
    const isPasted = lastPastedSegmentId === segment.id;

    // Handle click based on copy/paste mode
    const handleSegmentClick = async (event: React.MouseEvent) => {
        event.stopPropagation();

        if (isPasteMode) {
            // In paste mode, apply the copied material to this segment
            const updatedSegment = await pasteToSegment(segment);
            if (updatedSegment && onSegmentUpdated) {
                onSegmentUpdated(updatedSegment);
            }
            return;
        }

        if (isPickMode) {
            // In pick mode, copy this segment's material
            startPasteMode(segment);
            return;
        }

        // Default behavior: open the modal
        hooks.handleMouseClick();
    };

    // Determine cursor based on mode
    const getCursor = () => {
        if (isPasteMode) return PASTE_CURSOR;
        if (isPickMode) return PICK_CURSOR;
        return 'pointer';
    };

    // Get background highlight based on mode and state
    const getHighlightStyle = () => {
        if (isSourceSegment) {
            return {
                outline: '2px solid rgba(56, 142, 60, 0.8)',
                outlineOffset: '-2px',
            };
        }
        return {};
    };

    return (
        <Box
            className="assembly-layer-segment"
            sx={{
                maxWidth: `${hooks.segmentWidthMM.currentValue}px`,
                cursor: getCursor(),
                ...getHighlightStyle(),
                animation: isPasted ? 'pastePulse 600ms ease-out' : undefined,
                '@keyframes pastePulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(255, 193, 7, 0.6)' },
                    '70%': { boxShadow: '0 0 0 8px rgba(255, 193, 7, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(255, 193, 7, 0)' },
                },
                '&:hover': {
                    backgroundColor: isPasteMode || isPickMode ? 'rgba(255, 193, 7, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isPasteMode || isPickMode ? 'rgba(255, 193, 7, 0.8)' : undefined,
                },
            }}
            onMouseEnter={hooks.handleMouseEnter}
            onMouseLeave={hooks.handleMouseLeave}
        >
            {/* The LayerSegment rectangle */}
            <svg className="layer-segment-svg" width="100%" height="100%" onClick={handleSegmentClick}>
                <rect
                    className="layer-segment-rect"
                    width="100%"
                    height="100%"
                    style={{ fill: hooks.materialColor.currentValue }}
                />
            </svg>

            {/* Modal for input */}
            <SegmentPropertiesModal
                isModalOpen={hooks.isModalOpen}
                segmentId={segment.id}
                materialId={hooks.materialID}
                segmentWidthMM={hooks.segmentWidthMM}
                steelStudChecked={hooks.steelStudChecked}
                steelStudSpacingMM={hooks.steelStudSpacingMM}
                continuousInsulationChecked={hooks.continuousInsulationChecked}
                onDeleteSegment={segmentId => hooks.handleDeleteSegment(segmentId, onDeleteSegment)}
                onSubmit={() => hooks.handleSubmit(segment, onSegmentUpdated)}
                onModalClose={hooks.handleModalClose}
            />

            {/* Add Segment Buttons - hide during copy/paste mode */}
            {hooks.isSegmentHovered && userContext.user && !isPickMode && !isPasteMode ? (
                <>
                    <AddSegmentButton position="left" onClick={() => onAddSegmentLeft(segment)} />
                    <AddSegmentButton position="right" onClick={() => onAddSegmentRight(segment)} />
                </>
            ) : null}
        </Box>
    );
};

export default Segment;
