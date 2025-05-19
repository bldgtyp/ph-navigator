import React, { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useParams } from "react-router-dom";

import { uploadSitePhotoFiles } from "../../../../../../api/uploadSitePhotoFiles";
import { getWithAlert } from "../../../../../../api/getWithAlert";

import { SegmentType } from "../../types/Segment";
import { SitePhotoType, SitePhotosType } from "../../types/Material.Images";
import ImageFullViewModal from "./Image.FullViewModal";
import ImageThumbnail from "./Image.Thumbnail";



interface SegmentSitePhotosProps {
    segment: SegmentType;
    materialName: string;
    onUploadComplete?: (urls: string[]) => void;
}


const SegmentSitePhotos: React.FC<SegmentSitePhotosProps> = (props) => {
    const { projectId } = useParams();
    const [isDragOver, setIsDragOver] = useState(false);
    const [sitePhotos, setSitePhotos] = useState<SitePhotoType[]>([]);
    const [selectedSitePhoto, setSelectedSitePhoto] = useState<SitePhotoType | null>(null);

    useEffect(() => {
        const fetchSitePhotoUrls = async () => {
            console.log("Fetching site-photo-urls for segment:", props.segment.id);
            try {
                const response = await getWithAlert<SitePhotosType>(`gcp/get-site-photo-urls/${props.segment.id}`);
                if (response) {
                    setSitePhotos(response.photo_urls);
                }
            } catch (error) {
                console.error("Failed to fetch site-photo-urls thumbnails:", error);
            }
        }
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

        const files = e.dataTransfer.files;
        const response = await uploadSitePhotoFiles<SitePhotoType>(projectId, props.segment.id, files);
        const newPhotoUrls: SitePhotoType[] = response
            .filter((res): res is SitePhotoType => res !== null)
        setSitePhotos((prev) => [...prev, ...newPhotoUrls]);
    };

    return (
        <Box
            id="site-photo-urls"
            className="row-item thumbnail-container"
            sx={{
                border: isDragOver ? "1px dashed #1976d2" : `1px solid ${sitePhotos.length > 0 ? '#ccc' : 'var(--missing-strong)'}`,
                background: isDragOver ? "#e3f2fd" : "white",
            }}
            onMouseOver={() => setIsDragOver(true)}
            onMouseOut={() => setIsDragOver(false)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >

            {/* Thumbnails */}
            {sitePhotos.length === 0 && <span style={{ color: "var(--missing-strong)" }}>Site Photo Needed</span>}
            {sitePhotos.map((photo, idx) => <ImageThumbnail key={idx} image={photo} idx={idx} setSelectedImage={setSelectedSitePhoto} />)}

            <ImageFullViewModal selectedItem={selectedSitePhoto} setSelectedItem={setSelectedSitePhoto} />
        </Box>
    );
};

export default SegmentSitePhotos;