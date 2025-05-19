import { useState } from "react";
import { SegmentType } from "../../types/Segment";
import { convertArgbToRgba } from '../../types/Material';

export const useLayerSegmentHooks = (segment: SegmentType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // State variables for Segment Material
    const [currentMaterialId, setCurrentMaterialId] = useState<string>(segment.material.id);
    const [newMaterialId, setNewMaterialId] = useState<string>(segment.material.id);

    // State variables for Segment Width
    const [currentSegmentWidth, setCurrentWidth] = useState(segment.width_mm);
    const [newWidthMM, setNewWidth] = useState(segment.width_mm);

    // State variables for Segment Color
    const [currentMaterialColor, setCurrentMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));
    const [newMaterialColor, setNewMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));

    // Is Steel Stud Segment
    const [currentIsSteelStudChecked, setCurrentIsSteelStudChecked] = useState<boolean>(segment.steel_stud_spacing_mm !== null);
    const [newIsSteelStudChecked, setNewIsSteelStudChecked] = useState<boolean>(segment.steel_stud_spacing_mm !== null);

    // Steel Stud Spacing
    const [currentSteelStudSpacing, setCurrentSteelStudSpacing] = useState<number>(segment.steel_stud_spacing_mm || 406.4); // 16 inches
    const [newSteelStudSpacing, setNewSteelStudSpacing] = useState<number>(segment.steel_stud_spacing_mm || 406.4); // 16 inches

    // Continuous Insulation Checkbox
    const [currentContinuousInsulationChecked, setCurrentContinuousInsulationChecked] = useState<boolean>(segment.is_continuous_insulation);
    const [newContinuousInsulationChecked, setNewContinuousInsulationChecked] = useState<boolean>(segment.is_continuous_insulation);

    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => { setIsSegmentHovered(false); setIsModalOpen(true); };
    const handleModalClose = () => {
        setIsSegmentHovered(false);
        setNewMaterialColor(currentMaterialColor);
        setNewMaterialId(currentMaterialId);
        setNewWidth(currentSegmentWidth);
        setNewIsSteelStudChecked(currentIsSteelStudChecked);
        setNewSteelStudSpacing(currentSteelStudSpacing);
        setIsModalOpen(false);
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
        // 
        "handleMouseEnter": handleMouseEnter,
        "handleMouseLeave": handleMouseLeave,
        "handleMouseClick": handleMouseClick,
        "handleModalClose": handleModalClose,
        // Material Color
        "currentMaterialColor": currentMaterialColor,
        "setCurrentMaterialColor": setCurrentMaterialColor,
        "newMaterialColor": newMaterialColor,
        "setNewMaterialColor": setNewMaterialColor,
        // Is Steel Stud Segment
        "currentIsSteelStudChecked": currentIsSteelStudChecked,
        "setCurrentIsSteelStudChecked": setCurrentIsSteelStudChecked,
        "newIsSteelStudChecked": newIsSteelStudChecked,
        "setNewIsSteelStudChecked": setNewIsSteelStudChecked,
        // Steel Stud Spacing
        "currentSteelStudSpacing": currentSteelStudSpacing,
        "setCurrentSteelStudSpacing": setCurrentSteelStudSpacing,
        "newSteelStudSpacing": newSteelStudSpacing,
        "setNewSteelStudSpacing": setNewSteelStudSpacing,
        // Continuous Insulation Checkbox
        "currentContinuousInsulationChecked": currentContinuousInsulationChecked,
        "newContinuousInsulationChecked": newContinuousInsulationChecked,
        "setCurrentContinuousInsulationChecked": setCurrentContinuousInsulationChecked,
        "setNewContinuousInsulationChecked": setNewContinuousInsulationChecked,
    }
}