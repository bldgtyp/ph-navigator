import React, { useContext, useEffect, useState } from "react";
import { Box, Tooltip } from "@mui/material";
import { useParams } from "react-router-dom";

import { uploadDatasheetFiles } from "../../../../../../api/uploadDatasheetFiles";
import { getWithAlert } from "../../../../../../api/getWithAlert";

import { SegmentType } from "../../types/Segment";
import { MaterialDatasheetType, MaterialDatasheetsType } from "../../types/Material.Datasheet";
import ImageFullViewModal from "./Image.FullViewModal";
import ImageThumbnail from "./Image.Thumbnail";
import { UserContext } from "../../../../../auth/contexts/UserContext";


interface DatasheetsProps {
    segment: SegmentType;
    materialName: string;
    onUploadComplete?: (urls: string[]) => void;
}


const SegmentDatasheets: React.FC<DatasheetsProps> = (props) => {
    const userContext = useContext(UserContext);
    const { projectId } = useParams();
    const [isDragOver, setIsDragOver] = useState(false);
    const [datasheets, setDatasheets] = useState<MaterialDatasheetType[]>([]);
    const [selectedDatasheet, setSelectedDatasheet] = useState<MaterialDatasheetType | null>(null);

    useEffect(() => {
        const fetchDatasheets = async () => {
            console.log("Fetching datasheet thumbnails for segment:", props.segment.id);
            try {
                const response = await getWithAlert<MaterialDatasheetsType>(`gcp/get-datasheet-urls/${props.segment.id}`);
                if (response) {
                    setDatasheets(response.datasheet_urls);
                }
            } catch (error) {
                console.error("Failed to fetch thumbnails:", error);
            }
        }
        fetchDatasheets();
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
            alert("Please log in to upload files.");
            return null;
        }

        const files = e.dataTransfer.files;
        const response = await uploadDatasheetFiles<MaterialDatasheetType>(projectId, props.segment.id, files);
        const newPhotoUrls: MaterialDatasheetType[] = response
            .filter((res): res is MaterialDatasheetType => res !== null)
        setDatasheets((prev) => [...prev, ...newPhotoUrls]);
    };

    const handleSetSelectedDatasheet = (item: MaterialDatasheetType | null) => {
        setSelectedDatasheet(item);
        setIsDragOver(false);
    }

    return (
        <Tooltip title="Datasheets" placement="top" arrow>
            <Box
                id="datasheet-urls"
                className="row-item thumbnail-container"
                sx={{
                    border: isDragOver ? "1px dashed #1976d2" : `1px solid ${datasheets.length > 0 ? '#ccc' : 'var(--missing-strong)'}`,
                    background: isDragOver ? "#e3f2fd" : `${datasheets.length > 0 ? 'white' : 'var(--missing-weak)'}`,
                }}
                onMouseOver={() => setIsDragOver(true)}
                onMouseOut={() => setIsDragOver(false)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >

                {/* Thumbnails */}
                {datasheets.length === 0 && <span style={{ color: "var(--missing-strong)" }}>Product Datasheet Needed</span>}
                {datasheets.map((photo, idx) => <ImageThumbnail key={idx} image={photo} idx={idx} setSelectedImage={handleSetSelectedDatasheet} />)}

                <ImageFullViewModal selectedItem={selectedDatasheet} setSelectedItem={handleSetSelectedDatasheet} />
            </Box>
        </Tooltip>
    );
};

export default SegmentDatasheets;