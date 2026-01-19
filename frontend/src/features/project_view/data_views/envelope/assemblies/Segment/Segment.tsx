import { useContext } from 'react';
import { Box, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';

import SegmentPropertiesModal from '../SegmentPropertiesModal/LayerSegmentProperties';
import { SegmentType } from '../../_types/Segment';
import { useLayerSegmentHooks } from './Segment.Hooks';

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

    return (
        <Box
            className="assembly-layer-segment"
            sx={{ maxWidth: `${hooks.segmentWidthMM.currentValue}px` }}
            onMouseEnter={hooks.handleMouseEnter}
            onMouseLeave={hooks.handleMouseLeave}
        >
            {/* The LayerSegment rectangle */}
            <svg className="layer-segment-svg" width="100%" height="100%" onClick={hooks.handleMouseClick}>
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

            {/* Add Segment Buttons */}
            {hooks.isSegmentHovered && userContext.user ? (
                <>
                    <AddSegmentButton position="left" onClick={() => onAddSegmentLeft(segment)} />
                    <AddSegmentButton position="right" onClick={() => onAddSegmentRight(segment)} />
                </>
            ) : null}
        </Box>
    );
};

export default Segment;
