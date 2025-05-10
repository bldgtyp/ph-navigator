import { useParams } from "react-router-dom";
import { Box, Tooltip } from "@mui/material";

import ModalLayerSegment from "./Modal.LayerSegment";
import { SegmentType } from '../../types/Segment';
import { handleSubmit, handleDeleteSegment, handleWidthChange, handleMaterialChange } from "./LayerSegment.Handlers";
import { useLayerSegmentHooks } from "./LayerSegment.Hooks";

type LayerSegmentProps = {
    segment: SegmentType;
    onAddSegment: (segment: SegmentType) => void;
    onDeleteSegment: (segmentId: number) => void;
};

const AddSegmentButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Segment" placement="right">
            <button className="add-segment-button" onClick={props.onClick} >
                +
            </button>
        </Tooltip>

    )
}

const LayerSegment: React.FC<LayerSegmentProps> = ({ segment, onAddSegment, onDeleteSegment }) => {
    const { projectId } = useParams();
    const hooks = useLayerSegmentHooks(segment);

    return (
        <Box
            className="assembly-layer-segment"
            sx={{ maxWidth: `${hooks.currentSegmentWidth}px` }}
            onMouseEnter={hooks.handleMouseEnter}
            onMouseLeave={hooks.handleMouseLeave}
        >

            {/* The LayerSegment rectangle */}
            <svg className="layer-segment-svg" width="100%" height="100%" onClick={hooks.handleMouseClick}>
                <rect className="layer-segment-rect" width="100%" height="100%" />
            </svg>

            {/* Modal for input */}
            <ModalLayerSegment
                isModalOpen={hooks.isModalOpen}
                widthMM={hooks.newWidthMM}
                materialId={hooks.newMaterialId}
                segmentId={segment.id}
                handleWidthChange={(e) => handleWidthChange(e, hooks.setNewWidth)}
                handleDeleteSegment={(segmentId: number) => handleDeleteSegment(segmentId, onDeleteSegment, hooks.setIsModalOpen)}
                handleMaterialChange={(materialId) => handleMaterialChange(materialId, hooks.setNewMaterialId)}
                handleSubmit={() => handleSubmit(
                    hooks.newWidthMM,
                    hooks.currentSegmentWidth,
                    segment,
                    hooks.setCurrentWidth,
                    hooks.newMaterialId,
                    hooks.currentMaterialId,
                    hooks.setCurrentMaterialId,
                    hooks.setIsModalOpen
                )}
                handleModalClose={hooks.handleModalClose}
            />

            {/* Add Segment Button */}
            {hooks.isSegmentHovered && (<AddSegmentButton onClick={() => onAddSegment(segment)} />)}

        </Box>
    );
};

export default LayerSegment;