import { useParams } from "react-router-dom";
import { Box, Tooltip } from "@mui/material";

import LayerSegment from "./LayerSegment";
import ModalLayerHeight from "./Modal.LayerHeight";
import { LayerType } from '../../types/Layer';

import { handleAddSegmentToRight, handleDeleteSegment, handleLayerThicknessChange, handleSubmit } from "./Layer.Handlers";
import { useLayerHooks } from "./Layer.Hooks";

interface LayerProps {
    layer: LayerType;
    onAddLayer: (layer: LayerType) => void;
    onDeleteLayer: (layerId: number) => void;
}

const AddLayerButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Layer" placement="bottom">
            <button className="add-layer-button" onClick={(event) => { event.stopPropagation(); props.onClick(); }}>
                +
            </button>
        </Tooltip>

    )
}

const Layer: React.FC<LayerProps> = ({ layer, onAddLayer, onDeleteLayer }) => {
    const { projectId } = useParams();
    const hooks = useLayerHooks(layer);

    return (
        <Box className="assembly-layer">

            {/* Layer Left-Sidebar */}
            <Box
                className="assembly-layer-thickness"
                onClick={hooks.handleMouseClick}
                onMouseEnter={hooks.handleMouseEnter}
                onMouseLeave={hooks.handleMouseLeave}
            >
                {hooks.currentLayerThicknessMM}

                {/* Add-Layer Button */}
                {hooks.isLayerHovered && (<AddLayerButton onClick={() => onAddLayer(layer)} />)}
            </Box>

            <ModalLayerHeight
                isModalOpen={hooks.isModalOpen}
                handleModalClose={hooks.handleModalClose}
                layerHeightMM={hooks.newLayerThicknessMM}
                handleHeightChange={(e) => handleLayerThicknessChange(e, hooks.setNewLayerThicknessMM)}
                handleSubmit={() => handleSubmit(hooks.newLayerThicknessMM, hooks.currentLayerThicknessMM, layer, hooks.setCurrentLayerThicknessMM, hooks.setIsModalOpen)}
                handleDeleteLayer={() => onDeleteLayer(layer.id)} // Pass the layer ID to the handler
            />

            {/* The actual Graphic elements for the Layers Segments */}
            <Box className="assembly-layer-segments" sx={{ height: hooks.currentLayerThicknessMM }}>
                {hooks.segments.map((segment) => (
                    <LayerSegment
                        key={segment.id}
                        segment={segment}
                        onAddSegment={(segment) => handleAddSegmentToRight(segment, layer, hooks.segments, hooks.setSegments)}
                        onDeleteSegment={(segmentId) => handleDeleteSegment(segmentId, hooks.segments, hooks.setSegments)}
                    />
                ))}
            </Box>

        </Box>
    );
}

export default Layer;
