import '../../styles/Construction.css';
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Box, Tooltip } from "@mui/material";
import LayerSegmentAttributeModal from "./Construction.LayerSegment.AttributeModal";
import { Segment } from '../../types/Segment';


type ConstructionLayerSegmentProps = {
    segment: Segment;
    onAddSegment: (segmentId: number) => void;
    onDeleteSegment: (segmentId: number) => void;
};

const layerSegmentStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    padding: "0px",
    textAlign: "center",
    cursor: "pointer",
    height: "100%",
    position: "relative", // For positioning the '+' button
};

const AddSegmentButton: React.FC<{ onClick: () => void }> = (props) => {
    return (
        <Tooltip title="Add a New Segment" placement="right">
            <button
                style={{
                    position: "absolute",
                    top: "50%",
                    right: "-20px",
                    transform: "translateY(-50%) translateX(-50%)",
                    backgroundColor: "#b2087c",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                    zIndex: 1,
                }}
                onClick={props.onClick}
            >
                +
            </button>
        </Tooltip>

    )
}

const ConstructionLayerSegment: React.FC<ConstructionLayerSegmentProps> = ({ segment, onAddSegment, onDeleteSegment }) => {
    const { projectId } = useParams();
    const [currentMaterialId, setCurrentMaterialId] = useState(segment.material.id);
    const [currentSegmentWidth, setCurrentWidth] = useState(segment.width_mm);
    const [newWidth, setNewWidth] = useState(segment.width_mm);
    const [isWidthModalOpen, setIsWidthModalOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true); // Show the '+' button on hover
    };

    const handleMouseLeave = () => {
        // Hide the '+' button when not hovering
        setIsHovered(false);
    };

    const handleSvgClick = () => {
        // Open the modal when the SVG is clicked
        setIsWidthModalOpen(true);
    };

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Update the new width value
        setNewWidth(Number(e.target.value));
    };

    const handleWidthSubmit = () => {
        // Update the segment width
        setCurrentWidth(newWidth);
        setIsWidthModalOpen(false);
    };

    const handleModalClose = () => {
        // Close the modal without saving
        setIsWidthModalOpen(false);
    };

    const handleDeleteSegment = () => {
        onDeleteSegment(segment.id); // Call the delete handler
        setIsWidthModalOpen(false); // Close the modal
    };

    const handleMaterialChange = (materialId: string) => {
        setCurrentMaterialId(materialId); // Update the material ID
        // TODO: Optionally, update the segment's material in the global context or backend
    };

    return (
        <Box
            className="construction-layer-segment"
            sx={{ ...layerSegmentStyle, maxWidth: `${currentSegmentWidth}px` }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >

            {/* The LayerSegment rectangle */}
            <svg className="layer-segment-svg" width="100%" height="100%" onClick={handleSvgClick}>
                <rect className="layer-segment-rect" width="100%" height="100%" />
            </svg>

            {/* Modal for input */}
            <LayerSegmentAttributeModal
                isModalOpen={isWidthModalOpen}
                handleModalClose={handleModalClose}
                newWidth={newWidth}
                handleWidthChange={handleWidthChange}
                handleWidthSubmit={handleWidthSubmit}
                handleDeleteSegment={handleDeleteSegment}
                materialId={currentMaterialId} // Pass the current material ID
                handleMaterialChange={handleMaterialChange}
            />

            {/* Add Segment Button */}
            {isHovered && (<AddSegmentButton onClick={() => onAddSegment(segment.id)} />)}

        </Box>
    );
};

export default ConstructionLayerSegment;