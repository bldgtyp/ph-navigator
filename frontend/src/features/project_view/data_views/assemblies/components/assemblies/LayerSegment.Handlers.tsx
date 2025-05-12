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
    newWidthMM: number,
    currentSegmentWidth: number,
    newMaterialId: string,
    currentMaterialId: string,
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setCurrentWidth: React.Dispatch<React.SetStateAction<number>>,
    setCurrentMaterialId: React.Dispatch<React.SetStateAction<string>>,
    setCurrentMaterialColor: React.Dispatch<React.SetStateAction<any>>,
    setIsSegmentHovered: React.Dispatch<React.SetStateAction<boolean>>,
) => {
    try {
        // Update the segment width in the database if it has changed
        if (newWidthMM !== currentSegmentWidth) {
            const response = await patchWithAlert(`assembly/update_segment_width/${segment.id}`, null, {
                width_mm: newWidthMM,
            });

            if (response) {
                setCurrentWidth(newWidthMM);
            } else {
                console.error("Failed to update Segment-Width.");
            }
        }

        // Update the material in the database if it has changed
        if (newMaterialId !== currentMaterialId) {
            const response = await patchWithAlert<responseType>(`assembly/update_segment_material/${segment.id}`, null, {
                material_id: newMaterialId,
            });

            if (response) {
                setCurrentMaterialId(newMaterialId);
                setCurrentMaterialColor(convertArgbToRgba(response.material_argb_color, "#ccc"));
            } else {
                console.error("Failed to update Segment-Material.");
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
