import '../../styles/Construction.css';
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import { useState } from "react";
import ConstructionLayerSegment from "./Construction.LayerSegment";
import LayerHeightModal from "./Construction.Layer.HeightModal";
import { Layer } from '../../types/Layer';


type ConstructionLayerProps = {
    layer: Layer;
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
    fontSize: 8,
    justifyContent: "left",
    alignContent: "center",
    maxWidth: "35px",
    minWidth: "35px",
    width: "35px",
    borderRight: "1px dashed #ccc",
    cursor: "pointer",
}

const ConstructionLayer: React.FC<ConstructionLayerProps> = ({ layer }) => {
    const { projectId } = useParams();
    const [currentLayerHeight, setCurrentLayerHeight] = useState(layer.thickness_mm);
    const [newLayerHeight, setNewLayerHeight] = useState(layer.thickness_mm);
    const [isHeightModalOpen, setIsHeightModalOpen] = useState(false);
    const [segments, setSegments] = useState(layer.segments);

    const handleOnClick = () => {
        setIsHeightModalOpen(true);
    };

    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewLayerHeight(Number(e.target.value));
    };

    const handleHeightSubmit = () => {
        setCurrentLayerHeight(newLayerHeight);
        setIsHeightModalOpen(false);
    };

    const handleHeightModalClose = () => {
        setIsHeightModalOpen(false);
    };

    const handleAddSegment = (segmentId: number) => {
        // Add a new segment with default width
        const newSegment = {
            id: Date.now(),
            material: "New Material",
            width_mm: 50,
        };
        // TODO... fix:
        // setSegments([...segments, newSegment]);
    };

    const handleDeleteSegment = (id: number) => {
        setSegments(segments.filter((segment) => segment.id !== id));
    };

    return (
        <Box className="construction-layer" sx={layerStyle}>

            {/* Setup the left column with the Height, and a Modal for changing the Layer Height */}
            <Box className="construction-layer-thickness" sx={LayerThicknessStyle} onClick={handleOnClick}>{currentLayerHeight}</Box>
            <LayerHeightModal
                isModalOpen={isHeightModalOpen}
                handleModalClose={handleHeightModalClose}
                newLayerHeight={newLayerHeight}
                handleHeightChange={handleHeightChange}
                handleHeightSubmit={handleHeightSubmit}
            />

            {/* The actual Graphic elements for the Layers Segments */}
            <Box className="construction-layer-segments" sx={{ ...segmentStyle, height: currentLayerHeight }}>
                {segments.map((segment) => (
                    <ConstructionLayerSegment
                        key={segment.id}
                        segment={segment}
                        onAddSegment={handleAddSegment}
                        onDeleteSegment={handleDeleteSegment}
                    />
                ))}
            </Box>

        </Box>
    );
}

export default ConstructionLayer;
