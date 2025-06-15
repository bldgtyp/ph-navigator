import { useContext } from "react";
import { Box, Tooltip } from "@mui/material";

import { UserContext } from "../../../../../../auth/_contexts/UserContext";
import { useUnitConversion } from "../../../../../_hooks/useUnitConversion";

import Segment from "../Segment/Segment";
import ModalLayerThickness from "../LayerHeightModal/LayerHeight";
import { LayerType } from '../../../types/Layer';

import { useLayerHooks } from "./Layer.Hooks";

interface LayerProps {
    layer: LayerType;
    onAddLayer: (layer: LayerType) => void;
    onDeleteLayer: (layerId: number) => void;
}

const AddLayerButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Layer" placement="bottom">
            <button
                className="add-layer-button"
                onClick={(event) => { event.stopPropagation(); props.onClick(); }}
            >
                +
            </button>
        </Tooltip>

    )
}

const Layer: React.FC<LayerProps> = ({ layer, onAddLayer, onDeleteLayer }) => {
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion()
    const userContext = useContext(UserContext);
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
                {valueInCurrentUnitSystemWithDecimal(hooks.currentLayerThicknessMM, "mm", "in", unitSystem === "SI" ? 1 : 3)}

                {/* Add-Layer Button */}
                {hooks.isLayerHovered && userContext.user ? (<AddLayerButton onClick={() => onAddLayer(layer)} />) : null}
            </Box>

            <ModalLayerThickness
                isModalOpen={hooks.isModalOpen}
                onModalClose={hooks.handleModalClose}
                layerThickness={hooks.layerThicknessUserInputMM}
                onLayerThicknessChange={hooks.handleLayerThicknessChange}
                onSubmit={() => hooks.handleSubmitChangeLayerThickness(layer)}
                onDeleteLayer={() => onDeleteLayer(layer.id)}
            />

            {/* The actual Graphic elements for the Layers Segments */}
            <Box className="assembly-layer-segments" sx={{ height: hooks.currentLayerThicknessMM }}>
                {hooks.segments.map((segment) => (
                    <Segment
                        key={segment.id}
                        segment={segment}
                        onAddSegment={(segment) => hooks.handleAddSegmentToRight(segment, layer)}
                        onDeleteSegment={(segmentId) => hooks.handleDeleteSegment(segmentId)}
                    />
                ))}
            </Box>

        </Box>
    );
}

export default Layer;
