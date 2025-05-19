import "../../styles/Specification.css";
import "../../styles/MaterialsList.css";

import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { Box, Stack } from "@mui/material";

import { useMaterials } from "../../contexts/MaterialsContext";
import { UserContext } from "../../../../../auth/contexts/UserContext";

import { getWithAlert } from "../../../../../../api/getWithAlert";

import LoadingModal from "../../../shared/components/LoadingModal";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";

import { AssemblyType } from "../../types/Assembly";
import { SegmentType } from "../../types/Segment";
import SegmentSitePhotos from "./SegmentSitePhotos";
import SegmentDatasheets from "./SegmentDatasheets";
import DesignSpecificationStatus from "./DesignSpecificationStatus";


const MaterialListItem: React.FC<{ segment: SegmentType }> = (props) => {
    const userContext = useContext(UserContext);

    return (
        userContext.user || props.segment.specification_status !== "na" ? (
            <Stack className="material-row" direction="row" spacing={2} sx={{ padding: 1 }}>
                <Box className="row-item material-name" sx={{ flex: 1 }}>{props.segment.material.name}</Box>
                <DesignSpecificationStatus segment={props.segment} />
                <SegmentDatasheets segment={props.segment} materialName={props.segment.material.name} />
                <SegmentSitePhotos segment={props.segment} materialName={props.segment.material.name} />
            </Stack>
        ) : null
    );
}


const MaterialListContainer: React.FC<{ assembly: AssemblyType }> = (props) => {
    return (
        <Box className="assembly-material-list-container">
            <h4 className="assembly-title">Assembly: {props.assembly.name}</h4>
            {props.assembly.layers.map((layer) =>
                layer.segments.map((segment) => (
                    <MaterialListItem key={segment.id} segment={segment} />
                ))
            )}
        </Box>
    )
}


const MaterialListPage: React.FC = () => {
    const { projectId } = useParams();
    const { isLoadingMaterials, setMaterials } = useMaterials();
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);

    const fetchAssemblies = async () => {
        try {
            const response = await getWithAlert<AssemblyType[]>(`assembly/get_assemblies/${projectId}`);
            setAssemblies(response ?? []);
            return response ?? [];
        } catch (error) {
            console.error("Failed to fetch assemblies:", error);
            return [];
        } finally {
            setIsLoadingAssemblies(false);
        }
    };

    useEffect(() => {
        const initializeAssemblies = async () => {
            const fetchedAssemblies = await fetchAssemblies();
            if (fetchedAssemblies) {
                setAssemblies(fetchedAssemblies);
            }
        }

        initializeAssemblies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <>
            <ContentBlockHeader text={"Project Materials"} />
            <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />

            {assemblies.map((assembly) => (
                <MaterialListContainer key={assembly.id} assembly={assembly} />
            ))}
        </>
    )
}

export default MaterialListPage;