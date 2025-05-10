import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Tooltip } from "@mui/material";

import { patchWithAlert } from "../../../../../../api/patchWithAlert";
import { postWithAlert } from "../../../../../../api/postWithAlert";
import { deleteWithAlert } from "../../../../../../api/deleteWithAlert";

import LayerSegment from "./LayerSegment";
import ModalLayerHeight from "./Modal.LayerHeight";
import { LayerType } from '../../types/Layer';
import { SegmentType } from "../../types/Segment";

interface LayerProps {
    layer: LayerType;
    onAddLayer: (layer: LayerType) => void;
    onDeleteLayer: (layerId: number) => void;
}

const layerStyle = {
    display: "flex",
    flexDirection: "row",
    padding: "0px",
    borderBottom: "1px dashed #ccc"
}

const segmentStyle = {
    display: "flex",
    flex: 1,
    flexDirection: "row",
    padding: "0px",
    justifyContent: "center",
}

const LayerThicknessStyle = {
    flex: 0,
    position: "relative",
    fontSize: 8,
    justifyContent: "left",
    alignContent: "center",
    maxWidth: "35px",
    minWidth: "35px",
    width: "35px",
    borderRight: "1px dashed #ccc",
    cursor: "pointer",
}

const AddLayerButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Layer" placement="bottom">
            <button
                style={{
                    fontSize: "12px",
                    fontWeight: "800",
                    position: "absolute",
                    top: "100%",
                    right: "50%",
                    transform: "translateY(-50%) translateX(50%)",
                    backgroundColor: "#b2087c",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "15px",
                    height: "15px",
                    cursor: "pointer",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    props.onClick();
                }}
            >
                +
            </button>
        </Tooltip>

    )
}

const Layer: React.FC<LayerProps> = ({ layer, onAddLayer, onDeleteLayer }) => {
    const { projectId } = useParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLayerHovered, setIsLayerHovered] = useState(false);

    const [segments, setSegments] = useState(layer.segments);

    const [currentLayerThicknessMM, setCurrentLayerThicknessMM] = useState(layer.thickness_mm);
    const [newLayerThicknessMM, setNewLayerThicknessMM] = useState(layer.thickness_mm);

    const handleMouseEnter = () => setIsLayerHovered(true);
    const handleMouseLeave = () => setIsLayerHovered(false);
    const handleMouseClick = () => setIsModalOpen(true)
    const handleModalClose = () => {
        setNewLayerThicknessMM(currentLayerThicknessMM);
        setIsModalOpen(false);
    }
    const handleLayerThicknessChange = (e: React.ChangeEvent<HTMLInputElement>) => setNewLayerThicknessMM(Number(e.target.value));
    const handleSubmit = async () => {
        try {
            if (newLayerThicknessMM !== currentLayerThicknessMM) {
                const response = await patchWithAlert(`assembly/update_layer_thickness/${layer.id}`, null, {
                    thickness_mm: newLayerThicknessMM,
                });

                if (response) {
                    console.log(`Width updated successfully for layer ${layer.id}`);
                    setCurrentLayerThicknessMM(newLayerThicknessMM);
                } else {
                    console.error("Failed to update layer-thickness.");
                }
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to update layer:", error);
            setIsModalOpen(false);
        }
    };
    const handleAddSegmentToRight = async (segment: SegmentType) => {
        const DEFAULT_WIDTH = 25;

        try {
            // New Segment goes to the right of the current segment
            const orderPosition = segment.order + 1;

            // Call the backend API to add the new segment
            const response = await postWithAlert<{ message: string, segment_id: number }>(`assembly/add_layer_segment`, null, {
                layer_id: layer.id,
                material_id: segment.material.id, // Match the material ID from the segment
                width_mm: DEFAULT_WIDTH,
                order: orderPosition,
            });

            if (response) {
                console.log(`Segment added successfully: ${response.segment_id}`);

                // Add the new segment to the local state
                const newSegment: SegmentType = {
                    id: response.segment_id,
                    layer_id: layer.id,
                    material_id: segment.material.id,
                    material: segment.material,
                    width_mm: 50,
                    order: orderPosition,
                };

                // Update the segments array to reflect the insertion
                const updatedSegments = [...segments];
                updatedSegments.splice(orderPosition, 0, newSegment); // Insert the new segment
                updatedSegments.forEach((segment, index) => {
                    segment.order = index; // Recalculate the order for all segments
                });

                setSegments(updatedSegments);
            }
        } catch (error) {
            console.error("Failed to add segment:", error);
        }
    };
    const handleDeleteSegment = async (segmentId: number) => {
        try {
            // Call the backend API to delete the segment
            const response = await deleteWithAlert<{ message: string }>(`assembly/delete_layer_segment/${segmentId}`, null);

            if (response) {
                console.log(`Segment deleted successfully: ${segmentId}`);

                // Remove the segment from the local state
                const updatedSegments = segments.filter((segment) => segment.id !== segmentId);

                // Recalculate the order for the remaining segments
                updatedSegments.forEach((segment, index) => {
                    segment.order = index;
                });

                setSegments(updatedSegments);
            }
        } catch (error) {
            console.error("Failed to delete segment:", error);
        }
    };


    return (
        <Box className="assembly-layer" sx={layerStyle}>

            {/* Setup the left column with the Height, and a Modal for changing the Layer Height */}
            <Box
                className="assembly-layer-thickness"
                sx={LayerThicknessStyle}
                onClick={handleMouseClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {currentLayerThicknessMM}

                {/* Add Layer Button */}
                {isLayerHovered && (<AddLayerButton onClick={() => onAddLayer(layer)} />)}

            </Box>

            <ModalLayerHeight
                isModalOpen={isModalOpen}
                handleModalClose={handleModalClose}
                layerHeightMM={newLayerThicknessMM}
                handleHeightChange={handleLayerThicknessChange}
                handleSubmit={handleSubmit}
                handleDeleteLayer={() => onDeleteLayer(layer.id)} // Pass the layer ID to the handler
            />

            {/* The actual Graphic elements for the Layers Segments */}
            <Box className="assembly-layer-segments" sx={{ ...segmentStyle, height: currentLayerThicknessMM }}>
                {segments.map((segment) => (
                    <LayerSegment
                        key={segment.id}
                        segment={segment}
                        onAddSegment={handleAddSegmentToRight}
                        onDeleteSegment={handleDeleteSegment}
                    />
                ))}
            </Box>

        </Box>
    );
}

export default Layer;
