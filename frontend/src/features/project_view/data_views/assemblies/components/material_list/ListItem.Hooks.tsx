import { useState } from "react";
import { patchWithAlert } from "../../../../../../api/patchWithAlert";
import { SegmentType } from "../../types/Segment";

export const useMaterialListItemHooks = (segment: SegmentType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);
    const [currentNotes, setCurrentNotes] = useState(segment.notes || "");
    const [newNotes, setNewNotes] = useState(segment.notes || "");

    // Basic Handlers
    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => { setIsSegmentHovered(false); setIsModalOpen(true); };
    const handleModalClose = () => {
        setIsSegmentHovered(false);
        setIsModalOpen(false);
    };

    const handleNotesChange = (e: any) => {
        setNewNotes(e.target.value);
    }

    const handleSubmit = async (e: any) => {
        try {
            console.log(e.target.value);
            // Update the segment width in the database if it has changed
            if (newNotes !== currentNotes) {
                const response = await patchWithAlert<SegmentType>(`assembly/update-segment-notes/${segment.id}`, null, {
                    notes: newNotes,
                });

                if (response) {
                    setCurrentNotes(response.notes || "");
                } else {
                    console.error("Failed to update Segment-Notes.");
                }
            }

            setIsSegmentHovered(false);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error updating segment:", error);
            setIsSegmentHovered(false);
            setIsModalOpen(false);
        }
    }

    return {
        //
        "isModalOpen": isModalOpen,
        "setIsModalOpen": setIsModalOpen,
        "isSegmentHovered": isSegmentHovered,
        "setIsSegmentHovered": setIsSegmentHovered,
        // 
        "currentNotes": currentNotes,
        "setCurrentNotes": setCurrentNotes,
        "notes": newNotes,
        "setNotes": setNewNotes,
        //
        "handleMouseEnter": handleMouseEnter,
        "handleMouseLeave": handleMouseLeave,
        "handleMouseClick": handleMouseClick,
        "handleModalClose": handleModalClose,
        //
        "handleNotesChange": handleNotesChange,
        "handleSubmit": handleSubmit,
    }
}