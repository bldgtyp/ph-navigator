import React, { useContext, useMemo, useState } from 'react';
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

import { uploadSitePhotoFiles } from '../../../../../api/uploadSitePhotoFiles';

import { SegmentType, SpecificationStatus } from '../_types/Segment';
import { MaterialSitePhotoType } from '../_types/Material.SitePhoto';
import ImageFullViewModal from './Image.FullViewModal';
import LazyThumbnail from './LazyThumbnail';
import { UserContext } from '../../../../auth/_contexts/UserContext';
import { deleteWithAlert } from '../../../../../api/deleteWithAlert';
import { useMediaUrls } from '../_contexts/MediaUrlsContext';

interface SegmentSitePhotosProps {
    segment: SegmentType;
    materialName: string;
    specificationStatus: SpecificationStatus;
}

const SegmentSitePhotos: React.FC<SegmentSitePhotosProps> = props => {
    const userContext = useContext(UserContext);
    const { projectId } = useParams();
    const { getSitePhotosForSegment, addSitePhoto, removeSitePhoto } = useMediaUrls();
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedSitePhoto, setSelectedSitePhoto] = useState<MaterialSitePhotoType | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Get photos from context
    const sitePhotos = getSitePhotosForSegment(props.segment.id);

    const boxStyles = useMemo(() => {
        const isDisabled = props.specificationStatus === 'na';

        return {
            border: isDisabled
                ? '1px solid #ccc'
                : isDragOver
                  ? '1px dashed #1976d2'
                  : `1px solid ${sitePhotos.length > 0 ? '#ccc' : 'var(--missing-strong)'}`,
            background: isDisabled
                ? 'var(--appbar-bg-color)'
                : isDragOver
                  ? '#e3f2fd'
                  : `${sitePhotos.length > 0 ? 'white' : 'var(--missing-weak)'}`,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
        };
    }, [props.specificationStatus, isDragOver, sitePhotos.length]);

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
            const response = await uploadSitePhotoFiles<MaterialSitePhotoType>(projectId, props.segment.id, files);
            const newPhotoUrls: MaterialSitePhotoType[] = response.filter(
                (res): res is MaterialSitePhotoType => res !== null
            );

            // Add each new photo to context
            newPhotoUrls.forEach(photo => {
                addSitePhoto(props.segment.id, photo);
            });
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSetSelectedPhoto = (item: MaterialSitePhotoType | null) => {
        setSelectedSitePhoto(item);
        setIsDragOver(false);
    };

    const handleDeletePhoto = async (photoId: number) => {
        const success = await deleteWithAlert(`gcp/delete-segment-site-photo/${photoId}`);
        if (success) {
            // Update the context to remove the deleted photo
            removeSitePhoto(props.segment.id, photoId);
        }
    };

    return (
        <Tooltip title="Site-Photos" placement="top" arrow>
            <Box
                id="site-photo-urls"
                className={`row-item thumbnail-container`}
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
                {sitePhotos.length === 0 && (
                    <span style={{ color: 'var(--missing-strong)' }}>
                        {props.specificationStatus !== 'na' ? 'Site Photo Needed' : ''}
                    </span>
                )}
                {sitePhotos.map((photo, idx) => (
                    <LazyThumbnail key={photo.id} image={photo} idx={idx} setSelectedImage={handleSetSelectedPhoto} />
                ))}

                <ImageFullViewModal
                    selectedItem={selectedSitePhoto}
                    setSelectedItem={handleSetSelectedPhoto}
                    onDeleteSitePhoto={handleDeletePhoto}
                />
            </Box>
        </Tooltip>
    );
};

export default SegmentSitePhotos;
