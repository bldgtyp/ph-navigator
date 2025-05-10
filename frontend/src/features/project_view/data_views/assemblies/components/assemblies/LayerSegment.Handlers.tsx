import { SegmentType } from '../../types/Segment';
import { patchWithAlert } from "../../../../../../api/patchWithAlert";


export const handleSubmit = async (
    newWidthMM: number,
    currentSegmentWidth: number,
    segment: SegmentType,
    setCurrentWidth: React.Dispatch<React.SetStateAction<number>>,
    newMaterialId: string,
    currentMaterialId: string,
    setCurrentMaterialId: React.Dispatch<React.SetStateAction<string>>,
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
) => {
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
    setNewMaterialId: React.Dispatch<React.SetStateAction<string>>
) => setNewMaterialId(materialId);
