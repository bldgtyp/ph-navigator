import { useState } from "react";
import { SegmentType } from "../../types/Segment";

export const useLayerSegmentHooks = (segment: SegmentType) => {
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

    return {
        "isModalOpen": isModalOpen,
        "setIsModalOpen": setIsModalOpen,
        "isSegmentHovered": isSegmentHovered,
        "setIsSegmentHovered": setIsSegmentHovered,
        "currentMaterialId": currentMaterialId,
        "setCurrentMaterialId": setCurrentMaterialId,
        "newMaterialId": newMaterialId,
        "setNewMaterialId": setNewMaterialId,
        "currentSegmentWidth": currentSegmentWidth,
        "setCurrentWidth": setCurrentWidth,
        "newWidthMM": newWidthMM,
        "setNewWidth": setNewWidth,
        "handleMouseEnter": handleMouseEnter,
        "handleMouseLeave": handleMouseLeave,
        "handleMouseClick": handleMouseClick,
        "handleModalClose": handleModalClose,
    }
}