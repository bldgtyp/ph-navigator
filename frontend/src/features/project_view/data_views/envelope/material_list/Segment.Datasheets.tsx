import React, { useContext, useMemo, useState } from 'react';
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

import { uploadDatasheetFiles } from '../../../../../api/uploadDatasheetFiles';

import { SegmentType, SpecificationStatus } from '../_types/Segment';
import { MaterialDatasheetType } from '../_types/Material.Datasheet';
import ImageFullViewModal from './Image.FullViewModal';
import LazyThumbnail from './LazyThumbnail';
import { UserContext } from '../../../../auth/_contexts/UserContext';
import { deleteWithAlert } from '../../../../../api/deleteWithAlert';
import { useMediaUrls } from '../_contexts/MediaUrlsContext';

interface DatasheetsProps {
    segment: SegmentType;
    materialName: string;
    specificationStatus: SpecificationStatus;
}

const SegmentDatasheets: React.FC<DatasheetsProps> = props => {
    const userContext = useContext(UserContext);
    const { projectId } = useParams();
    const { getDatasheetsForSegment, addDatasheet, removeDatasheet } = useMediaUrls();
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedDatasheet, setSelectedDatasheet] = useState<MaterialDatasheetType | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Get datasheets from context
    const datasheets = getDatasheetsForSegment(props.segment.id);

    const boxStyles = useMemo(() => {
        const isDisabled = props.specificationStatus === 'na';

        return {
            border: isDisabled
                ? '1px solid #ccc'
                : isDragOver
                  ? '1px dashed #1976d2'
                  : `1px solid ${datasheets.length > 0 ? '#ccc' : 'var(--missing-strong)'}`,
            background: isDisabled
                ? 'var(--appbar-bg-color)'
                : isDragOver
                  ? '#e3f2fd'
                  : `${datasheets.length > 0 ? 'white' : 'var(--missing-weak)'}`,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
        };
    }, [props.specificationStatus, isDragOver, datasheets.length]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!userContext.user) {
            alert('Please log in to upload files.');
            return null;
        }

        const files = e.dataTransfer.files;

        // Show loading state
        setIsUploading(true);

        try {
            const response = await uploadDatasheetFiles<MaterialDatasheetType>(projectId, props.segment.id, files);
            const newDatasheets: MaterialDatasheetType[] = response.filter(
                (res): res is MaterialDatasheetType => res !== null
            );

            // Add each new datasheet to context
            newDatasheets.forEach(datasheet => {
                addDatasheet(props.segment.id, datasheet);
            });
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSetSelectedDatasheet = (item: MaterialDatasheetType | null) => {
        setSelectedDatasheet(item);
        setIsDragOver(false);
    };

    const handleDeleteDatasheet = async (datasheetId: number) => {
        const success = await deleteWithAlert(`gcp/delete-segment-datasheet/${datasheetId}`);
        if (success) {
            // Update the context to remove the deleted datasheet
            removeDatasheet(props.segment.id, datasheetId);
        }
    };

    return (
        <Tooltip title="Datasheets" placement="top" arrow>
            <Box
                id="datasheet-urls"
                className="row-item thumbnail-container"
                sx={boxStyles}
                onMouseOver={() => setIsDragOver(true)}
                onMouseOut={() => setIsDragOver(false)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Loading Overlay */}
                {isUploading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            zIndex: 10,
                            flexDirection: 'row',
                            gap: 1,
                        }}
                    >
                        <CircularProgress size={24} />
                        <Typography variant="body2">Uploading...</Typography>
                    </Box>
                )}

                {/* Thumbnails */}
                {datasheets.length === 0 && (
                    <span style={{ color: 'var(--missing-strong)' }}>
                        {props.specificationStatus !== 'na' ? 'Product Datasheet Needed' : ''}
                    </span>
                )}
                {datasheets.map((datasheet, idx) => (
                    <LazyThumbnail
                        key={datasheet.id}
                        image={datasheet}
                        idx={idx}
                        setSelectedImage={handleSetSelectedDatasheet}
                    />
                ))}

                <ImageFullViewModal
                    selectedItem={selectedDatasheet}
                    setSelectedItem={handleSetSelectedDatasheet}
                    onDeleteSitePhoto={handleDeleteDatasheet}
                />
            </Box>
        </Tooltip>
    );
};

export default SegmentDatasheets;
