import { useEffect, useState } from 'react';
import { SegmentType } from '../../_types/Segment';
import { convertArgbToRgba } from '../../_types/Material';
import { patchWithAlert } from '../../../../../../api/patchWithAlert';
import { UpdatableInput } from '../../../../../types/UpdatableInput';

export const useLayerSegmentHooks = (segment: SegmentType) => {
    // Basic Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // Segment Color
    const [currentMaterialColor, setCurrentMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));
    const [newMaterialColor, setNewMaterialColor] = useState(convertArgbToRgba(segment.material.argb_color));
    const materialColor = new UpdatableInput<string, { materialColor: string }>(
        currentMaterialColor,
        setCurrentMaterialColor,
        newMaterialColor,
        (args: { materialColor: string }) => {
            setNewMaterialColor(args.materialColor);
        }
    );

    // Segment Material
    const [currentMaterialId, setCurrentMaterialId] = useState<string>(segment.material.id);
    const [newMaterialId, setNewMaterialId] = useState<string>(segment.material.id);
    const materialID = new UpdatableInput<string, { materialId: string; materialColor: string }>(
        currentMaterialId,
        setCurrentMaterialId,
        newMaterialId,
        (args: { materialId: string; materialColor: string }) => {
            setNewMaterialId(args.materialId);
            setNewMaterialColor(args.materialColor);
        }
    );

    // Segment Width
    const [currentSegmentWidthMM, setCurrentSegmentWidthMM] = useState(segment.width_mm);
    const [newSegmentWidthMM, setNewSegmentWidthMM] = useState(segment.width_mm);
    const segmentWidthMM = new UpdatableInput<number, { widthMM: number }>(
        currentSegmentWidthMM,
        setCurrentSegmentWidthMM,
        newSegmentWidthMM,
        (args: { widthMM: number }) => {
            setNewSegmentWidthMM(args.widthMM);
        }
    );

    // Is Steel Stud Segment Checkbox
    const [currentIsSteelStudChecked, setCurrentIsSteelStudChecked] = useState<boolean>(
        segment.steel_stud_spacing_mm !== null
    );
    const [newIsSteelStudChecked, setNewIsSteelStudChecked] = useState<boolean>(segment.steel_stud_spacing_mm !== null);
    const steelStudChecked = new UpdatableInput<boolean, { checked: boolean }>(
        currentIsSteelStudChecked,
        setCurrentIsSteelStudChecked,
        newIsSteelStudChecked,
        (args: { checked: boolean }) => {
            setNewIsSteelStudChecked(args.checked);
        }
    );

    // Steel Stud Spacing
    const [currentSteelStudSpacingMM, setCurrentSteelStudSpacingMM] = useState<number>(
        segment.steel_stud_spacing_mm || 406.4
    ); // 16 inches
    const [newSteelStudSpacingMM, setNewSteelStudSpacingMM] = useState<number>(segment.steel_stud_spacing_mm || 406.4); // 16 inches
    const steelStudSpacingMM = new UpdatableInput<number, { steelStudSpacingMM: number }>(
        currentSteelStudSpacingMM,
        setCurrentSteelStudSpacingMM,
        newSteelStudSpacingMM,
        (args: { steelStudSpacingMM: number }) => {
            setNewSteelStudSpacingMM(args.steelStudSpacingMM);
        }
    );

    // Continuous Insulation Checkbox
    const [currentContinuousInsulationChecked, setCurrentContinuousInsulationChecked] = useState<boolean>(
        segment.is_continuous_insulation
    );
    const [newContinuousInsulationChecked, setNewContinuousInsulationChecked] = useState<boolean>(
        segment.is_continuous_insulation
    );
    const continuousInsulationChecked = new UpdatableInput<boolean, { checked: boolean }>(
        currentContinuousInsulationChecked,
        setCurrentContinuousInsulationChecked,
        newContinuousInsulationChecked,
        (args: { checked: boolean }) => {
            setNewContinuousInsulationChecked(args.checked);
        }
    );

    // Sync state when segment prop changes (e.g., after paste or undo operation)
    // Using specific primitive values as dependencies ensures the effect runs
    // even if the segment object reference doesn't change
    useEffect(() => {
        const newColor = convertArgbToRgba(segment.material.argb_color);
        setCurrentMaterialColor(newColor);
        setNewMaterialColor(newColor);

        setCurrentMaterialId(segment.material.id);
        setNewMaterialId(segment.material.id);

        setCurrentSegmentWidthMM(segment.width_mm);
        setNewSegmentWidthMM(segment.width_mm);

        const hasSteelStud = segment.steel_stud_spacing_mm !== null;
        setCurrentIsSteelStudChecked(hasSteelStud);
        setNewIsSteelStudChecked(hasSteelStud);

        setCurrentSteelStudSpacingMM(segment.steel_stud_spacing_mm || 406.4);
        setNewSteelStudSpacingMM(segment.steel_stud_spacing_mm || 406.4);

        setCurrentContinuousInsulationChecked(segment.is_continuous_insulation);
        setNewContinuousInsulationChecked(segment.is_continuous_insulation);
    }, [
        segment.id,
        segment.material.id,
        segment.material.argb_color,
        segment.width_mm,
        segment.steel_stud_spacing_mm,
        segment.is_continuous_insulation,
    ]);

    // Handlers
    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => {
        setIsSegmentHovered(false);
        setIsModalOpen(true);
    };
    const handleModalClose = () => {
        setIsSegmentHovered(false);
        setNewMaterialColor(currentMaterialColor);
        setNewMaterialId(currentMaterialId);
        setNewSegmentWidthMM(currentSegmentWidthMM);
        setNewIsSteelStudChecked(currentIsSteelStudChecked);
        setNewSteelStudSpacingMM(currentSteelStudSpacingMM);
        setIsModalOpen(false);
    };

    const handleSubmit = async (segment: SegmentType, onSegmentUpdated?: (updatedSegment: SegmentType) => void) => {
        let updatedSegment: SegmentType | null = null;
        try {
            // Update the segment width in the database if it has changed
            if (newSegmentWidthMM !== currentSegmentWidthMM) {
                const response = await patchWithAlert<SegmentType>(
                    `assembly/update-segment-width/${segment.id}`,
                    null,
                    {
                        width_mm: newSegmentWidthMM,
                    }
                );

                if (response) {
                    setCurrentSegmentWidthMM(response.width_mm);
                    updatedSegment = response;
                } else {
                    console.error('Failed to update Segment-Width.');
                }
            }

            // Update the material in the database if it has changed
            if (newMaterialId !== currentMaterialId) {
                const response = await patchWithAlert<SegmentType>(
                    `assembly/update-segment-material/${segment.id}`,
                    null,
                    {
                        material_id: newMaterialId,
                    }
                );

                if (response) {
                    setCurrentMaterialId(response.material.id);
                    setCurrentMaterialColor(convertArgbToRgba(response.material.argb_color, '#ccc'));
                    updatedSegment = response;
                } else {
                    console.error('Failed to update Segment-Material.');
                }
            }

            // Update the steel stud spacing in the database if it has changed
            if (
                newIsSteelStudChecked !== currentIsSteelStudChecked ||
                (newIsSteelStudChecked && newSteelStudSpacingMM !== currentSteelStudSpacingMM)
            ) {
                const response = await patchWithAlert<SegmentType>(
                    `assembly/update-segment-steel-stud-spacing/${segment.id}`,
                    null,
                    {
                        steel_stud_spacing_mm: newIsSteelStudChecked ? newSteelStudSpacingMM : null,
                    }
                );

                if (response) {
                    setCurrentIsSteelStudChecked(newIsSteelStudChecked);
                    setCurrentSteelStudSpacingMM(newSteelStudSpacingMM);
                    updatedSegment = response;
                } else {
                    console.error('Failed to update Segment-Steel-Stud.');
                }
            }

            // Update the continuous insulation in the database if it has changed
            if (newContinuousInsulationChecked !== currentContinuousInsulationChecked) {
                const response = await patchWithAlert<SegmentType>(
                    `assembly/update-segment-is-continuous-insulation/${segment.id}`,
                    null,
                    {
                        is_continuous_insulation: newContinuousInsulationChecked,
                    }
                );

                if (response) {
                    setCurrentContinuousInsulationChecked(response.is_continuous_insulation);
                    updatedSegment = response;
                } else {
                    console.error('Failed to update Segment-Continuous-Insulation.');
                }
            }

            if (updatedSegment && onSegmentUpdated) {
                onSegmentUpdated(updatedSegment);
            }

            setIsSegmentHovered(false);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to update material:', error);
            setIsSegmentHovered(false);
            setIsModalOpen(false);
        }
    };

    const handleDeleteSegment = (segmentId: number, onDeleteSegment: (segmentId: number) => void) => {
        onDeleteSegment(segmentId); // Call the delete handler
        setIsModalOpen(false); // Close the modal
    };

    return {
        isModalOpen: isModalOpen,
        isSegmentHovered: isSegmentHovered,
        handleMouseEnter: handleMouseEnter,
        handleMouseLeave: handleMouseLeave,
        handleMouseClick: handleMouseClick,
        handleModalClose: handleModalClose,
        handleSubmit: handleSubmit,
        handleDeleteSegment: handleDeleteSegment,
        materialID: materialID,
        materialColor: materialColor,
        segmentWidthMM: segmentWidthMM,
        steelStudChecked: steelStudChecked,
        steelStudSpacingMM: steelStudSpacingMM,
        continuousInsulationChecked: continuousInsulationChecked,
    };
};
