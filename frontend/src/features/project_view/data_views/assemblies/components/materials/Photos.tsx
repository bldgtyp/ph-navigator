import React, { useState } from "react";
import { Box, Modal } from "@mui/material";
import { uploadImageFile } from "../../../../../../api/uploadImageFiles";
import { useParams } from "react-router-dom";

interface PhotosProps {
    photo_urls: string[];
    onUploadComplete?: (urls: string[]) => void;
}

const Photos: React.FC<PhotosProps> = ({ photo_urls, onUploadComplete }) => {
    const { projectId } = useParams();
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Drag-and-drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        console.log("Dropped file:", files[0]);
        uploadImageFile(projectId, files[0])
    };

    return (
        <Box
            className="row-item photo-urls"
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: isDragOver ? "2px dashed #1976d2" : "1px solid #ccc",
                borderRadius: 2,
                padding: 1,
                minHeight: 60,
                background: isDragOver ? "#e3f2fd" : "white",
                cursor: "pointer",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >

            {/* Thumbnails */}
            {photo_urls.length === 0 && <span style={{ color: "#888" }}>No photos</span>}
            {photo_urls.map((url, idx) => (
                <img
                    key={idx}
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
                    onClick={() => setSelectedPhoto(url)}
                />
            ))}


            {/* Modal for enlarged photo */}
            <Modal open={!!selectedPhoto} onClose={() => setSelectedPhoto(null)}>
                <Box
                    sx={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        bgcolor: "background.paper",
                        boxShadow: 24,
                        p: 2,
                        outline: "none",
                        maxWidth: "90vw",
                        maxHeight: "90vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {selectedPhoto && (
                        <img
                            src={selectedPhoto}
                            alt="Enlarged"
                            style={{ maxWidth: "80vw", maxHeight: "80vh", borderRadius: 8 }}
                        />
                    )}
                </Box>
            </Modal>

        </Box>
    );
};

export default Photos;