import '../_styles/Specification.css';
import '../_styles/MaterialsList.css';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';

import { useMaterials } from '../_contexts/MaterialsContext';
import { MediaUrlsProvider, ProjectMediaUrlsResponse, useMediaUrls } from '../_contexts/MediaUrlsContext';

import { getWithAlert } from '../../../../../api/getWithAlert';

import LoadingModal from '../../_components/LoadingModal';
import ContentBlockHeader from '../../_components/ContentBlock.Header';

import { AssemblyType } from '../_types/Assembly';
import MaterialListItem from './ListItem';
import ContentBlock from '../../_components/ContentBlock';

const MaterialListContainer: React.FC<{ assembly: AssemblyType }> = props => {
    return (
        <Box className="assembly-material-list-container">
            <h4 className="assembly-title">Assembly: {props.assembly.name}</h4>
            {props.assembly.layers.map(layer =>
                layer.segments.map(segment => <MaterialListItem key={segment.id} segment={segment} />)
            )}
        </Box>
    );
};

const MaterialListContent: React.FC = () => {
    const { projectId } = useParams();
    const { isLoadingMaterials } = useMaterials();
    const { setMediaFromResponse, setIsLoadingMedia, isLoadingMedia } = useMediaUrls();
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch assemblies and media URLs in parallel
                const [assembliesResponse, mediaResponse] = await Promise.all([
                    getWithAlert<AssemblyType[]>(`assembly/get-assemblies/${projectId}`),
                    getWithAlert<ProjectMediaUrlsResponse>(`gcp/get-project-media-urls/${projectId}`),
                ]);

                setAssemblies(assembliesResponse ?? []);

                if (mediaResponse) {
                    setMediaFromResponse(mediaResponse);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setIsLoadingAssemblies(false);
                setIsLoadingMedia(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <ContentBlock>
            <ContentBlockHeader text={'Project Materials'} />
            <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies || isLoadingMedia} />

            {assemblies.map(assembly => (
                <MaterialListContainer key={assembly.id} assembly={assembly} />
            ))}
        </ContentBlock>
    );
};

const MaterialListPage: React.FC = () => {
    return (
        <MediaUrlsProvider>
            <MaterialListContent />
        </MediaUrlsProvider>
    );
};

export default MaterialListPage;
