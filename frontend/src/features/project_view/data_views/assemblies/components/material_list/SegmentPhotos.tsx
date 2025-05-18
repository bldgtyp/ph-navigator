import React, { useState } from "react";
import { Box, Modal } from "@mui/material";
import { uploadImageFiles } from "../../../../../../api/uploadImageFiles";
import { useParams } from "react-router-dom";

interface PhotosProps {
    photo_urls: string[];
    segmentId: number;
    materialName: string;
    onUploadComplete?: (urls: string[]) => void;
}

const cleanFilenames = (materialName: string, files: FileList): FileList => {
    // Remove whitespace, commas, and other illegal filename characters
    const sanitize = (name: string) =>
        name
            .replace(/[/\\?%*:|"<>.,\s]+/g, "_") // replace illegal chars and whitespace with underscore
            .replace(/_+/g, "_") // collapse multiple underscores
            .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores

    const cleanedFiles = Array.from(files).map((file) => {
        const baseName = sanitize(materialName);
        const originalName = sanitize(file.name);
        const newName = `${baseName}_${originalName}`;
        return new File([file], newName, { type: file.type });
    });

    const dataTransfer = new DataTransfer();
    cleanedFiles.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
};

const SegmentPhotos: React.FC<PhotosProps> = (props) => {
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

    const handleDrop = async (e: React.DragEvent, materialName: string) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        const filesWithCleanNames = cleanFilenames(materialName, files);
        console.log("Dropped file:", filesWithCleanNames);
        const results = await uploadImageFiles(
            projectId,
            props.segmentId,
            filesWithCleanNames
        )
        console.log("Upload results:", results);

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
            onDrop={(e) => handleDrop(e, props.materialName)}
        >

            {/* Thumbnails */}
            {props.photo_urls.length === 0 && <span style={{ color: "#888" }}>No photos</span>}
            {props.photo_urls.map((url, idx) => (
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

export default SegmentPhotos;