import React, { useContext, useEffect, useState } from 'react';
import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';

import { uploadSitePhotoFiles } from '../../../../../../api/uploadSitePhotoFiles';
import { getWithAlert } from '../../../../../../api/getWithAlert';

import { SegmentType } from '../../types/Segment';
import { MaterialSitePhotoType, MaterialSitePhotosType } from '../../types/Material.SitePhoto';
import ImageFullViewModal from './Image.FullViewModal';
import ImageThumbnail from './Image.Thumbnail';
import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { deleteWithAlert } from '../../../../../../api/deleteWithAlert';

interface SegmentSitePhotosProps {
    segment: SegmentType;
    materialName: string;
    onUploadComplete?: (urls: string[]) => void;
}

const SegmentSitePhotos: React.FC<SegmentSitePhotosProps> = props => {
    const userContext = useContext(UserContext);
    const { projectId } = useParams();
    const [isDragOver, setIsDragOver] = useState(false);
    const [sitePhotos, setSitePhotos] = useState<MaterialSitePhotoType[]>([]);
    const [selectedSitePhoto, setSelectedSitePhoto] = useState<MaterialSitePhotoType | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchSitePhotoUrls = async () => {
            console.log('Fetching site-photo-urls for segment:', props.segment.id);
            try {
                const response = await getWithAlert<MaterialSitePhotosType>(
                    `gcp/get-site-photo-urls/${props.segment.id}`
                );
                if (response) {
                    setSitePhotos(response.photo_urls);
                }
            } catch (error) {
                console.error('Failed to fetch site-photo-urls thumbnails:', error);
            }
        };
        fetchSitePhotoUrls();
    }, [projectId, props.segment.id]);

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
            setSitePhotos(prev => [...prev, ...newPhotoUrls]);

            // Optional: Show success message
            if (newPhotoUrls.length > 0) {
                // You could show a success notification here
            }
        } catch (error) {
            console.error('Upload failed:', error);
            // Optional: Show error message
        } finally {
            // Hide loading state
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
            // Update the local state to remove the deleted photo
            setSitePhotos(sitePhotos.filter(photo => photo.id !== photoId));
        }
    };

    return (
        <Tooltip title="Site-Photos" placement="top" arrow>
            <Box
                id="site-photo-urls"
                className="row-item thumbnail-container"
                sx={{
                    border: isDragOver
                        ? '1px dashed #1976d2'
                        : `1px solid ${sitePhotos.length > 0 ? '#ccc' : 'var(--missing-strong)'}`,
                    background: isDragOver ? '#e3f2fd' : `${sitePhotos.length > 0 ? 'white' : 'var(--missing-weak)'}`,
                }}
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
                {sitePhotos.length === 0 && <span style={{ color: 'var(--missing-strong)' }}>Site Photo Needed</span>}
                {sitePhotos.map((photo, idx) => (
                    <ImageThumbnail key={idx} image={photo} idx={idx} setSelectedImage={handleSetSelectedPhoto} />
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
