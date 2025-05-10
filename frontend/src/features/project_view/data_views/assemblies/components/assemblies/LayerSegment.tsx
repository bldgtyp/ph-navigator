import '../../styles/Assembly.css';
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Box, Tooltip } from "@mui/material";
import ModalLayerSegment from "./Modal.LayerSegment";
import { SegmentType } from '../../types/Segment';
import { patchWithAlert } from "../../../../../../api/patchWithAlert";

type LayerSegmentProps = {
    segment: SegmentType;
    onAddSegment: (segment: SegmentType) => void;
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
                    fontSize: "14px",
                    fontWeight: "800",
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                onClick={props.onClick}
            >
                +
            </button>
        </Tooltip>

    )
}

const LayerSegment: React.FC<LayerSegmentProps> = ({ segment, onAddSegment, onDeleteSegment }) => {
    const { projectId } = useParams();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // State variables for Segment Material
    const [currentMaterialId, setCurrentMaterialId] = useState(segment.material.id);
    const [newMaterialId, setNewMaterialId] = useState(segment.material.id);

    // State variables for Segment Width
    const [currentSegmentWidth, setCurrentWidth] = useState(segment.width_mm);
    const [newWidthMM, setNewWidth] = useState(segment.width_mm);

    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => setIsModalOpen(true)
    const handleModalClose = () => {
        setNewMaterialId(currentMaterialId);
        setNewWidth(currentSegmentWidth);
        setIsModalOpen(false)
    };
    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => { setNewWidth(Number(e.target.value)) };
    const handleMaterialChange = (materialId: string) => setNewMaterialId(materialId);
    const handleSubmit = async () => {
        try {
            // Update the segment width in the database if it has changed
            if (newWidthMM !== currentSegmentWidth) {
                const response = await patchWithAlert(`assembly/update_segment_width/${segment.id}`, null, {
                    width_mm: newWidthMM,
                });

                if (response) {
                    console.log(`Width updated successfully for segment ${segment.id}`);
                    setCurrentWidth(newWidthMM);
                } else {
                    console.error("Failed to update Segment-Width.");
                }

            }

            // Update the material in the database if it has changed
            if (newMaterialId !== currentMaterialId) {
                const response = await patchWithAlert(`assembly/update_segment_material/${segment.id}`, null, {
                    material_id: newMaterialId,
                });

                if (response) {
                    console.log(`Material updated successfully for segment ${segment.id}`);
                    setCurrentMaterialId(newMaterialId);
                } else {
                    console.error("Failed to update Segment-Material.");
                }
            }

            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to update material:", error);
            setIsModalOpen(false);
        }
    };
    const handleDeleteSegment = (segmentId: number) => {
        onDeleteSegment(segmentId); // Call the delete handler
        setIsModalOpen(false); // Close the modal
    };
    return (
        <Box
            className="assembly-layer-segment"
            sx={{ ...layerSegmentStyle, maxWidth: `${currentSegmentWidth}px` }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >

            {/* The LayerSegment rectangle */}
            <svg className="layer-segment-svg" width="100%" height="100%" onClick={handleMouseClick}>
                <rect className="layer-segment-rect" width="100%" height="100%" />
            </svg>

            {/* Modal for input */}
            <ModalLayerSegment
                isModalOpen={isModalOpen}
                widthMM={newWidthMM}
                materialId={newMaterialId}
                segmentId={segment.id}
                handleWidthChange={handleWidthChange}
                handleDeleteSegment={handleDeleteSegment}
                handleMaterialChange={handleMaterialChange}
                handleSubmit={handleSubmit}
                handleModalClose={handleModalClose}
            />

            {/* Add Segment Button */}
            {isSegmentHovered && (<AddSegmentButton onClick={() => onAddSegment(segment)} />)}

        </Box>
    );
};

export default LayerSegment;