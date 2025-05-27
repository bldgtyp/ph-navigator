import { SegmentType } from '../../types/Segment';
import { patchWithAlert } from "../../../../../../api/patchWithAlert";
import { convertArgbToRgba } from '../../types/Material';

interface responseType {
    message: string;
    material_id: number;
    material_name: string;
    material_argb_color: string;
}


export const handleSubmit = async (
    segment: SegmentType,
    // Segment Width
    newSegmentWidthMM: number,
    currentSegmentWidthMM: number,
    setCurrentWidth: React.Dispatch<React.SetStateAction<number>>,
    // Material Type
    newMaterialId: string,
    currentMaterialId: string,
    setCurrentMaterialId: React.Dispatch<React.SetStateAction<string>>,
    setCurrentMaterialColor: React.Dispatch<React.SetStateAction<any>>,
    // Is Steel Stud
    currentIsSteelStud: boolean,
    newIsSteelStud: boolean,
    setCurrentIsSteelStudChecked: React.Dispatch<React.SetStateAction<boolean>>,
    // Steel Stud Spacing
    currentSteelStudSpacing: number,
    newSteelStudSpacing: number,
    setCurrentSteelStudSpacing: React.Dispatch<React.SetStateAction<number>>,
    // Continuous Insulation Checkbox
    currentContinuousInsulationChecked: boolean,
    newContinuousInsulationChecked: boolean,
    setCurrentContinuousInsulationChecked: React.Dispatch<React.SetStateAction<boolean>>,
    // Vis
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setIsSegmentHovered: React.Dispatch<React.SetStateAction<boolean>>,
) => {
    try {
        // Update the segment width in the database if it has changed
        if (newSegmentWidthMM !== currentSegmentWidthMM) {
            const response = await patchWithAlert(`assembly/update-segment-width/${segment.id}`, null, {
                width_mm: newSegmentWidthMM,
            });

            if (response) {
                setCurrentWidth(newSegmentWidthMM);
            } else {
                console.error("Failed to update Segment-Width.");
            }
        }

        // Update the material in the database if it has changed
        if (newMaterialId !== currentMaterialId) {
            const response = await patchWithAlert<responseType>(`assembly/update-segment-material/${segment.id}`, null, {
                material_id: newMaterialId,
            });

            if (response) {
                setCurrentMaterialId(newMaterialId);
                setCurrentMaterialColor(convertArgbToRgba(response.material_argb_color, "#ccc"));
            } else {
                console.error("Failed to update Segment-Material.");
            }
        }

        // Update the steel stud spacing in the database if it has changed
        if (newIsSteelStud !== currentIsSteelStud || (newIsSteelStud && newSteelStudSpacing !== currentSteelStudSpacing)) {
            console.log("in here")
            console.log("newIsSteelStud ? newSteelStudSpacing : null = ", newIsSteelStud ? newSteelStudSpacing : null)
            const response = await patchWithAlert(`assembly/update-segment-steel-stud-spacing/${segment.id}`, null, {
                steel_stud_spacing_mm: newIsSteelStud ? newSteelStudSpacing : null
            });


            if (response) {
                setCurrentIsSteelStudChecked(newIsSteelStud);
                setCurrentSteelStudSpacing(newSteelStudSpacing);
            } else {
                console.error("Failed to update Segment-Steel-Stud.");
            }
        }

        // Update the continuous insulation in the database if it has changed
        if (newContinuousInsulationChecked !== currentContinuousInsulationChecked) {
            const response = await patchWithAlert(`assembly/update-segment-continuous-insulation/${segment.id}`, null, {
                is_continuous_insulation: newContinuousInsulationChecked,
            });

            if (response) {
                setCurrentContinuousInsulationChecked(newContinuousInsulationChecked);
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


export const handleDeleteSegment = (
    segmentId: number,
    onDeleteSegment: (segmentId: number) => void,
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
) => {
    onDeleteSegment(segmentId); // Call the delete handler
    setIsModalOpen(false); // Close the modal
};


export const handleWidthChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setNewWidth: React.Dispatch<React.SetStateAction<number>>
) => { setNewWidth(Number(e.target.value)) };


export const handleMaterialChange = (
    materialId: string,
    materialColor: string,
    setNewMaterialId: React.Dispatch<React.SetStateAction<string>>,
    setNewMaterialColor: React.Dispatch<React.SetStateAction<string>>,
) => {
    setNewMaterialId(materialId);
    setNewMaterialColor(materialColor);
};


export const handleSteelStudCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setNewIsSteelStudChecked: React.Dispatch<React.SetStateAction<boolean>>
) => {
    const isChecked = e.target.checked;
    setNewIsSteelStudChecked(isChecked);
}


export const handleSteelStudSpacingChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setNewSteelStudSpacing: React.Dispatch<React.SetStateAction<number>>
) => {
    const value = Number(e.target.value);
    setNewSteelStudSpacing(value);
}


export const handleContinuousInsulationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setNewContinuousInsulationChecked: React.Dispatch<React.SetStateAction<boolean>>
) => {
    const isChecked = e.target.checked;
    setNewContinuousInsulationChecked(isChecked);
}
