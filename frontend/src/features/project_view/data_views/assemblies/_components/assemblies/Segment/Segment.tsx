import { useContext } from "react";
import { Box, Tooltip } from "@mui/material";

import { UserContext } from "../../../../../../auth/_contexts/UserContext";

import ModalLayerSegment from "../SegmentPropertiesModal/LayerSegmentProperties";
import { SegmentType } from '../../../types/Segment';
import { useLayerSegmentHooks } from "./Segment.Hooks";


type SegmentProps = {
    segment: SegmentType;
    onAddSegment: (segment: SegmentType) => void;
    onDeleteSegment: (segmentId: number) => void;
};

const AddSegmentButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Segment" placement="right">
            <button className="create-new-segment-button" onClick={props.onClick} >
                +
            </button>
        </Tooltip>

    )
}

const Segment: React.FC<SegmentProps> = ({ segment, onAddSegment, onDeleteSegment }) => {
    const userContext = useContext(UserContext);
    const hooks = useLayerSegmentHooks(segment);

    return (
        <Box
            className="assembly-layer-segment"
            sx={{ maxWidth: `${hooks.currentSegmentWidthMM}px` }}
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
                widthMM={hooks.newSegmentWidthMM}
                materialId={hooks.newMaterialId}
                segmentId={segment.id}
                onSegmentWidthChange={(e) => hooks.handleSegmentWidthChange(Number(e.target.value))}
                handleDeleteSegment={(segmentId: number) => hooks.handleDeleteSegment(segmentId, onDeleteSegment)}
                handleMaterialChange={(materialId: string, materialColor: string) => hooks.handleMaterialChange(materialId, materialColor)}
                handleSubmit={() => hooks.handleSubmit(segment)}
                handleModalClose={hooks.handleModalClose}
                steelStudChecked={hooks.newIsSteelStudChecked}
                handleCheckboxChange={(e) => hooks.setNewIsSteelStudChecked(e.target.checked)}
                steelStudSpacing={hooks.newSteelStudSpacing}
                handleSteelStudSpacingChange={(e) => hooks.setNewSteelStudSpacing(Number(e.target.value))}
                isConInsulationChecked={hooks.newContinuousInsulationChecked}
                handleConInsulationChange={(e) => hooks.setNewContinuousInsulationChecked(e.target.checked)}
            />

            {/* Add Segment Button */}
            {hooks.isSegmentHovered && userContext.user ? (<AddSegmentButton onClick={() => onAddSegment(segment)} />) : null}

        </Box>
    );
};

export default Segment;