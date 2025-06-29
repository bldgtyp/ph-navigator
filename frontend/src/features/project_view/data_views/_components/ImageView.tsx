import { useState } from 'react';
import { Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ThumbnailType {
    url: string;
    width: number;
    height: number;
}

interface ThumbnailsCollectionType {
    full: ThumbnailType;
    large: ThumbnailType;
    small: ThumbnailType;
}

interface PhotosRecordType {
    id: string;
    width: number;
    height: number;
    url: string;
    filename: string;
    size: number;
    type: string;
    thumbnails: ThumbnailsCollectionType;
}

interface ImageViewProps {
    value?: PhotosRecordType[] | string;
}

export const ImageView: React.FC<ImageViewProps> = ({ value }) => {
    const [selectedImage, setSelectedImage] = useState<PhotosRecordType | null>(null);
    const [open, setOpen] = useState(false);

    // Open the modal with the selected image
    const handleImageClick = (photo: PhotosRecordType) => {
        setSelectedImage(photo);
        setOpen(true);
    };

    // Close the modal
    const handleClose = () => {
        setOpen(false);
    };

    // If it is a type string, it is the default '-' value
    if (typeof value === 'string') {
        return <div className="photos-cell">-</div>;
    }

    // If there is no item...
    if (value === undefined || value.length === 0) {
        return <div className="photos-cell">-</div>;
    }

    return (
        <>
            <div className="photos-cell">
                {value.map(photo => {
                    return (
                        <img
                            key={photo.id}
                            src={photo.thumbnails.small.url}
                            width={photo.thumbnails.small.width}
                            height={photo.thumbnails.small.height}
                            alt={photo.filename}
                            style={{ marginRight: 8, cursor: 'pointer' }}
                            onClick={() => handleImageClick(photo)}
                        />
                    );
                })}
            </div>

            {/* Full-screen image modal */}
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="xl"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            boxShadow: 'none',
                            position: 'relative',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                    },
                }}
            >
                <IconButton
                    onClick={handleClose}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        color: 'white',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>

                {selectedImage && (
                    <img
                        src={selectedImage.thumbnails.full.url}
                        alt={selectedImage.filename}
                        style={{
                            maxWidth: '90%',
                            maxHeight: '90%',
                            objectFit: 'contain',
                        }}
                    />
                )}

                {selectedImage && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 16,
                            left: 0,
                            width: '100%',
                            textAlign: 'center',
                            color: 'white',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            padding: '8px 0',
                        }}
                    >
                        {selectedImage.filename}
                    </div>
                )}
            </Dialog>
        </>
    );
};
