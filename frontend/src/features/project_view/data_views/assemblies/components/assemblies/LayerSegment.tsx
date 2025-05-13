import { useContext } from "react";
import { Box, Tooltip } from "@mui/material";

import { UserContext } from "../../../../../auth/contexts/UserContext";

import ModalLayerSegment from "./Modal.LayerSegment";
import { SegmentType } from '../../types/Segment';
import { handleSubmit, handleDeleteSegment, handleWidthChange, handleMaterialChange, handleSteelStudCheckboxChange, handleSteelStudSpacingChange } from "./LayerSegment.Handlers";
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
    const userContext = useContext(UserContext);
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
                <rect className="layer-segment-rect" width="100%" height="100%" style={{ fill: hooks.currentMaterialColor }} />
            </svg>

            {/* Modal for input */}
            <ModalLayerSegment
                isModalOpen={hooks.isModalOpen}
                widthMM={hooks.newWidthMM}
                materialId={hooks.newMaterialId}
                segmentId={segment.id}
                handleWidthChange={(e) => handleWidthChange(e, hooks.setNewWidth)}
                handleDeleteSegment={(segmentId: number) => handleDeleteSegment(segmentId, onDeleteSegment, hooks.setIsModalOpen)}
                handleMaterialChange={(materialId: string, materialColor: string) => handleMaterialChange(materialId, materialColor, hooks.setNewMaterialId, hooks.setNewMaterialColor)}
                handleSubmit={() => handleSubmit(
                    segment,
                    hooks.newWidthMM,
                    hooks.currentSegmentWidth,
                    hooks.newMaterialId,
                    hooks.currentMaterialId,
                    hooks.setIsModalOpen,
                    hooks.setCurrentWidth,
                    hooks.setCurrentMaterialId,
                    hooks.setCurrentMaterialColor,
                    hooks.setIsSegmentHovered,
                )}
                handleModalClose={hooks.handleModalClose}
                steelStudChecked={hooks.newIsSteelStudChecked}
                handleCheckboxChange={(e) => handleSteelStudCheckboxChange(e, hooks.setNewIsSteelStudChecked)}
                steelStudSpacing={hooks.newSteelStudSpacing}
                handleSteelStudSpacingChange={(e) => handleSteelStudSpacingChange(e, hooks.setNewSteelStudSpacing)}
            />

            {/* Add Segment Button */}
            {hooks.isSegmentHovered && userContext.user ? (<AddSegmentButton onClick={() => onAddSegment(segment)} />) : null}

        </Box>
    );
};

export default LayerSegment;