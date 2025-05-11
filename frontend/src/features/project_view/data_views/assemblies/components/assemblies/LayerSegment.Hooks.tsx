import { useState } from "react";
import { SegmentType } from "../../types/Segment";
import { convertArgbToRgba } from '../../types/Material';

export const useLayerSegmentHooks = (segment: SegmentType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // State variables for Segment Material
    const [currentMaterialId, setCurrentMaterialId] = useState(segment.material.id);
    const [newMaterialId, setNewMaterialId] = useState(segment.material.id);

    // State variables for Segment Width
    const [currentSegmentWidth, setCurrentWidth] = useState(segment.width_mm);
    const [newWidthMM, setNewWidth] = useState(segment.width_mm);

    // State variables for Segment Color
    const [currentMaterialColor, setCurrentMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));
    const [newMaterialColor, setNewMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));

    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => setIsModalOpen(true)
    const handleModalClose = () => {
        setNewMaterialColor(currentMaterialColor);
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
        "currentMaterialColor": currentMaterialColor,
        "setCurrentMaterialColor": setCurrentMaterialColor,
        "newMaterialColor": newMaterialColor,
        "setNewMaterialColor": setNewMaterialColor,
    }
}