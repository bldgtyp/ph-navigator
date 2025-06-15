import { useState } from "react";
import { SegmentType } from "../../../types/Segment";
import { convertArgbToRgba } from '../../../types/Material';
import { patchWithAlert } from "../../../../../../../api/patchWithAlert";

export const useLayerSegmentHooks = (segment: SegmentType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // State variables for Segment Material
    const [currentMaterialId, setCurrentMaterialId] = useState<string>(segment.material.id);
    const [newMaterialId, setNewMaterialId] = useState<string>(segment.material.id);

    // State variables for Segment Width
    const [currentSegmentWidthMM, setCurrentSegmentWidthMM] = useState(segment.width_mm);
    const [newSegmentWidthMM, setNewSegmentWidthMM] = useState(segment.width_mm);

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

    // Handlers
    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => { setIsSegmentHovered(false); setIsModalOpen(true); };
    const handleModalClose = () => {
        setIsSegmentHovered(false);
        setNewMaterialColor(currentMaterialColor);
        setNewMaterialId(currentMaterialId);
        setNewSegmentWidthMM(currentSegmentWidthMM);
        setNewIsSteelStudChecked(currentIsSteelStudChecked);
        setNewSteelStudSpacing(currentSteelStudSpacing);
        setIsModalOpen(false);
    };

    const handleSubmit = async (segment: SegmentType) => {
        try {
            // Update the segment width in the database if it has changed
            if (newSegmentWidthMM !== currentSegmentWidthMM) {
                const response = await patchWithAlert<SegmentType>(`assembly/update-segment-width/${segment.id}`, null, {
                    width_mm: newSegmentWidthMM,
                });

                if (response) {
                    setCurrentSegmentWidthMM(response.width_mm);
                } else {
                    console.error("Failed to update Segment-Width.");
                }
            }

            // Update the material in the database if it has changed
            if (newMaterialId !== currentMaterialId) {
                const response = await patchWithAlert<SegmentType>(`assembly/update-segment-material/${segment.id}`, null, {
                    material_id: newMaterialId,
                });

                if (response) {
                    setCurrentMaterialId(response.material.id);
                    setCurrentMaterialColor(convertArgbToRgba(response.material.argb_color, "#ccc"));
                } else {
                    console.error("Failed to update Segment-Material.");
                }
            }

            // Update the steel stud spacing in the database if it has changed
            if (newIsSteelStudChecked !== currentIsSteelStudChecked || (newIsSteelStudChecked && newSteelStudSpacing !== currentSteelStudSpacing)) {
                console.log("in here")
                console.log("newIsSteelStudChecked ? newSteelStudSpacing : null = ", newIsSteelStudChecked ? newSteelStudSpacing : null)
                const response = await patchWithAlert<SegmentType>(`assembly/update-segment-steel-stud-spacing/${segment.id}`, null, {
                    steel_stud_spacing_mm: newIsSteelStudChecked ? newSteelStudSpacing : null
                });


                if (response) {
                    setCurrentIsSteelStudChecked(newIsSteelStudChecked);
                    setCurrentSteelStudSpacing(newSteelStudSpacing);
                } else {
                    console.error("Failed to update Segment-Steel-Stud.");
                }
            }

            // Update the continuous insulation in the database if it has changed
            if (newContinuousInsulationChecked !== currentContinuousInsulationChecked) {
                const response = await patchWithAlert<SegmentType>(`assembly/update-segment-is-continuous-insulation/${segment.id}`, null, {
                    is_continuous_insulation: newContinuousInsulationChecked,
                });

                if (response) {
                    setCurrentContinuousInsulationChecked(response.is_continuous_insulation);
                } else {
                    console.error("Failed to update Segment-Continuous-Insulation.");
                }
            }

            setIsSegmentHovered(false)
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to update material:", error);
            setIsSegmentHovered(false)
            setIsModalOpen(false);
        }
    };

    const handleDeleteSegment = (
        segmentId: number,
        onDeleteSegment: (segmentId: number) => void,
    ) => {
        onDeleteSegment(segmentId); // Call the delete handler
        setIsModalOpen(false); // Close the modal
    };

    const handleMaterialChange = (
        materialId: string,
        materialColor: string,
    ) => {
        setNewMaterialId(materialId);
        setNewMaterialColor(materialColor);
    };

    return {
        "isModalOpen": isModalOpen,
        "isSegmentHovered": isSegmentHovered,
        "newMaterialId": newMaterialId,
        "currentSegmentWidthMM": currentSegmentWidthMM,
        "newSegmentWidthMM": newSegmentWidthMM,
        "setNewSegmentWidthMM": setNewSegmentWidthMM,
        "handleMouseEnter": handleMouseEnter,
        "handleMouseLeave": handleMouseLeave,
        "handleMouseClick": handleMouseClick,
        "handleModalClose": handleModalClose,
        "currentMaterialColor": currentMaterialColor,
        "newIsSteelStudChecked": newIsSteelStudChecked,
        "newSteelStudSpacing": newSteelStudSpacing,
        "newContinuousInsulationChecked": newContinuousInsulationChecked,
        "handleSubmit": handleSubmit,
        "setNewContinuousInsulationChecked": setNewContinuousInsulationChecked,
        "setNewIsSteelStudChecked": setNewIsSteelStudChecked,
        "setNewSteelStudSpacing": setNewSteelStudSpacing,
        "handleMaterialChange": handleMaterialChange,
        "handleDeleteSegment": handleDeleteSegment,
    };
};