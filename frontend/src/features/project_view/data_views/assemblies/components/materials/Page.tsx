import "../../styles/Specification.css";
import "../../styles/Materials.css";

import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import { Box, Stack } from "@mui/material";

import { useMaterials } from "../../contexts/MaterialsContext";
import { UserContext } from "../../../../../auth/contexts/UserContext";

import { getWithAlert } from "../../../../../../api/getWithAlert";

import LoadingModal from "../../../shared/components/LoadingModal";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";

import { AssemblyType } from "../../types/Assembly";
import { LayerType } from "../../types/Layer";
import { SegmentType } from "../../types/Segment";
import Photos from "./Photos";

const AssemblyLayerSegment: React.FC<{ layer: LayerType, segment: SegmentType }> = (props) => {
    const userContext = useContext(UserContext);

    return (
        userContext.user || props.segment.specification_status !== "na" ? (
            <Stack className="material-row" direction="row" spacing={2} sx={{ padding: 1 }}>
                <Box className="row-item material-name">
                    {props.segment.material.name}
                </Box>
                <Box className={`row-item have-specification have-specification-${props.segment.specification_status}`}>
                    Spec: {props.segment.specification_status}
                </Box>
                <Box className="row-item datasheet-urls">
                    {/* {props.segment.data_sheet_urls} */}
                    Datasheet
                </Box>
                <Photos photo_urls={[]} />
            </Stack>
        ) : null
    );
}


const AssemblyMaterialContainer: React.FC<{ assembly: AssemblyType }> = (props) => {
    return (
        <Box className="assembly-material-list-container">
            <h4 className="assembly-title">Assembly: {props.assembly.id}</h4>
            {props.assembly.layers.map((layer) =>
                layer.segments.map((segment) => (
                    <AssemblyLayerSegment key={segment.id} layer={layer} segment={segment} />
                ))
            )}
        </Box>
    )
}


const MaterialsPage: React.FC = () => {
    const userContext = useContext(UserContext);
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
            <ContentBlockHeader
                text={"Assembly Materials:"}
            />
            <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />
            {assemblies.map((assembly) => (
                <AssemblyMaterialContainer key={assembly.id} assembly={assembly} />
            ))}

        </>
    )
}

export default MaterialsPage;