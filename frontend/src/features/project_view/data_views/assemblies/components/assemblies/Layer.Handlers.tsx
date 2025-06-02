import { patchWithAlert } from "../../../../../../api/patchWithAlert";
import { postWithAlert } from "../../../../../../api/postWithAlert";
import { deleteWithAlert } from "../../../../../../api/deleteWithAlert";

import { LayerType } from '../../types/Layer';
import { SegmentType, SpecificationStatus } from "../../types/Segment";


export const handleAddSegmentToRight = async (
    segment: SegmentType,
    layer: LayerType,
    segments: SegmentType[],
    setSegments: React.Dispatch<React.SetStateAction<SegmentType[]>>
) => {
    const DEFAULT_WIDTH = 50;

    try {
        // New Segment goes to the right of the current segment
        const orderPosition = segment.order + 1;

        // Call the backend API to add the new segment
        const response = await postWithAlert<SegmentType>(`assembly/create-new-segment`, null, {
            layer_id: layer.id,
            material_id: segment.material.id, // Match the material ID from the segment
            width_mm: DEFAULT_WIDTH,
            order: orderPosition,
        });

        if (response) {
            // Add the new segment to the local state
            const newSegment: SegmentType = {
                id: response.id,
                layer_id: response.layer_id,
                material_id: response.material.id,
                material: response.material,
                width_mm: response.width_mm,
                order: response.order,
                steel_stud_spacing_mm: null,
                is_continuous_insulation: false,
                specification_status: SpecificationStatus.NA,
                material_photos: [],
                material_datasheets: [],
                notes: null,
            };

            // Update the segments array to reflect the insertion
            const updatedSegments = [...segments];
            updatedSegments.splice(orderPosition, 0, newSegment); // Insert the new segment
            updatedSegments.forEach((segment, index) => {
                segment.order = index; // Recalculate the order for all segments
            });

            setSegments(updatedSegments);
        }
    } catch (error) {
        console.error("Failed to add segment:", error);
    }
};

export const handleDeleteSegment = async (
    segmentId: number,
    segments: SegmentType[],
    setSegments: React.Dispatch<React.SetStateAction<SegmentType[]>>
) => {
    try {
        // Call the backend API to delete the segment
        const response = await deleteWithAlert<{ message: string }>(`assembly/delete-segment/${segmentId}`, null);

        if (response) {
            // Remove the segment from the local state
            const updatedSegments = segments.filter((segment) => segment.id !== segmentId);

            // Recalculate the order for the remaining segments
            updatedSegments.forEach((segment, index) => {
                segment.order = index;
            });

            setSegments(updatedSegments);
        }
    } catch (error) {
        console.error("Failed to delete segment:", error);
    }
};

export const handleSubmit = async (
    newLayerThicknessMM: number,
    currentLayerThicknessMM: number,
    layer: LayerType,
    setCurrentLayerThicknessMM: React.Dispatch<React.SetStateAction<number>>,
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
) => {
    try {
        if (newLayerThicknessMM !== currentLayerThicknessMM) {
            const response = await patchWithAlert(`assembly/update-layer-thickness/${layer.id}`, null, {
                thickness_mm: newLayerThicknessMM,
            });

            if (response) {
                setCurrentLayerThicknessMM(newLayerThicknessMM);
            } else {
                console.error("Failed to update layer-thickness.");
            }
        }

        setIsModalOpen(false);
    } catch (error) {
        console.error("Failed to update layer:", error);
        setIsModalOpen(false);
    }
};

export const handleLayerThicknessChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setNewLayerThicknessMM: React.Dispatch<React.SetStateAction<number>>
) => setNewLayerThicknessMM(Number(e.target.value));
