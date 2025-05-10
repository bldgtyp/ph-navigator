import { useState } from "react";
import { LayerType } from "../../types/Layer";

export const useLayerHooks = (layer: LayerType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLayerHovered, setIsLayerHovered] = useState(false);

    const [segments, setSegments] = useState(layer.segments);

    const [currentLayerThicknessMM, setCurrentLayerThicknessMM] = useState(layer.thickness_mm);
    const [newLayerThicknessMM, setNewLayerThicknessMM] = useState(layer.thickness_mm);

    const handleMouseEnter = () => setIsLayerHovered(true);
    const handleMouseLeave = () => setIsLayerHovered(false);
    const handleMouseClick = () => setIsModalOpen(true)
    const handleModalClose = () => { setNewLayerThicknessMM(currentLayerThicknessMM); setIsModalOpen(false); }

    return {
        "isModalOpen": isModalOpen,
        "setIsModalOpen": setIsModalOpen,
        "isLayerHovered": isLayerHovered,
        "setIsLayerHovered": setIsLayerHovered,
        "segments": segments,
        "setSegments": setSegments,
        "currentLayerThicknessMM": currentLayerThicknessMM,
        "setCurrentLayerThicknessMM": setCurrentLayerThicknessMM,
        "newLayerThicknessMM": newLayerThicknessMM,
        "setNewLayerThicknessMM": setNewLayerThicknessMM,
        "handleMouseEnter": handleMouseEnter,
        "handleMouseLeave": handleMouseLeave,
        "handleMouseClick": handleMouseClick,
        "handleModalClose": handleModalClose,
    }
};