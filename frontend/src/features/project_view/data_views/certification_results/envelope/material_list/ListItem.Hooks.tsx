import { useState } from 'react';
import { patchWithAlert } from '../../../../../../api/patchWithAlert';
import { SegmentType, SpecificationStatus } from '../_types/Segment';
import { SelectChangeEvent } from '@mui/material';
import { UpdatableInput } from '../../../../../types/UpdatableInput';

export const useMaterialListItemHooks = (segment: SegmentType) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSegmentHovered, setIsSegmentHovered] = useState(false);

    // Mouse Handlers
    const handleMouseEnter = () => setIsSegmentHovered(true);
    const handleMouseLeave = () => setIsSegmentHovered(false);
    const handleMouseClick = () => {
        setIsSegmentHovered(false);
        setIsModalOpen(true);
    };

    // Notes
    const [currentNotes, setCurrentNotes] = useState(segment.notes || '');
    const [newNotes, setNewNotes] = useState(segment.notes || '');
    const notes = new UpdatableInput<string, { notes: string }>(
        currentNotes,
        setCurrentNotes,
        newNotes,
        (args: { notes: string }) => {
            setNewNotes(args.notes);
        }
    );

    // Specification Status
    const [specificationStatus, setSpecificationStatus] = useState(segment.specification_status);
    const handleChangeSpecificationStatus = async (event: SelectChangeEvent<SpecificationStatus>) => {
        const newStatus = event.target.value as SpecificationStatus;
        setSpecificationStatus(newStatus);

        try {
            const response = await patchWithAlert<SegmentType>(
                `assembly/update-segment-specification-status/${segment.id}`,
                null,
                { specification_status: newStatus }
            );

            if (response) {
                setSpecificationStatus(response.specification_status);
            } else {
                console.error('Failed to update Segment-Specification-Status.');
                alert('Failed to update status.');
            }
        } catch (error) {
            setSpecificationStatus(segment.specification_status);
            alert('Failed to update status.');
        }
    };

    // Modal Handlers
    const handleModalClose = () => {
        setIsSegmentHovered(false);
        setIsModalOpen(false);
    };

    const handleSubmit = async (e: any) => {
        try {
            console.log(e.target.value);
            // Update the segment width in the database if it has changed
            if (newNotes !== currentNotes) {
                const response = await patchWithAlert<SegmentType>(
                    `assembly/update-segment-notes/${segment.id}`,
                    null,
                    {
                        notes: newNotes,
                    }
                );

                if (response) {
                    setCurrentNotes(response.notes || '');
                } else {
                    console.error('Failed to update Segment-Notes.');
                }
            }

            setIsSegmentHovered(false);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error updating segment:', error);
            setIsSegmentHovered(false);
            setIsModalOpen(false);
        }
    };

    return {
        //
        isModalOpen: isModalOpen,
        setIsModalOpen: setIsModalOpen,
        isSegmentHovered: isSegmentHovered,
        setIsSegmentHovered: setIsSegmentHovered,
        //
        notes: notes,
        specificationStatus: specificationStatus,
        handleChangeSpecificationStatus: handleChangeSpecificationStatus,
        //
        handleMouseEnter: handleMouseEnter,
        handleMouseLeave: handleMouseLeave,
        handleMouseClick: handleMouseClick,
        handleModalClose: handleModalClose,
        handleSubmit: handleSubmit,
    };
};
