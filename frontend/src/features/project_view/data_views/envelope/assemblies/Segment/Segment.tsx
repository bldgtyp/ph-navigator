import { useContext } from 'react';
import { Box, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';

import ModalLayerSegment from '../SegmentPropertiesModal/LayerSegmentProperties';
import { SegmentType } from '../../_types/Segment';
import { useLayerSegmentHooks } from './Segment.Hooks';

type SegmentProps = {
    segment: SegmentType;
    onAddSegment: (segment: SegmentType) => void;
    onDeleteSegment: (segmentId: number) => void;
};

const AddSegmentButton: React.FC<{ onClick: () => void }> = props => {
    return (
        <Tooltip title="Add a New Segment" placement="right">
            <button className="create-new-segment-button" onClick={props.onClick}>
                +
            </button>
        </Tooltip>
    );
};

const Segment: React.FC<SegmentProps> = ({ segment, onAddSegment, onDeleteSegment }) => {
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
            <ModalLayerSegment
                isModalOpen={hooks.isModalOpen}
                segmentId={segment.id}
                materialId={hooks.materialID}
                segmentWidthMM={hooks.segmentWidthMM}
                steelStudChecked={hooks.steelStudChecked}
                steelStudSpacingMM={hooks.steelStudSpacingMM}
                continuousInsulationChecked={hooks.continuousInsulationChecked}
                onDeleteSegment={segmentId => hooks.handleDeleteSegment(segmentId, onDeleteSegment)}
                onSubmit={() => hooks.handleSubmit(segment)}
                onModalClose={hooks.handleModalClose}
            />

            {/* Add Segment Button */}
            {hooks.isSegmentHovered && userContext.user ? (
                <AddSegmentButton onClick={() => onAddSegment(segment)} />
            ) : null}
        </Box>
    );
};

export default Segment;
