import '../_styles/Specification.css';
import '../_styles/MaterialsList.css';

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';

import { useMaterials } from '../_contexts/MaterialsContext';

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

const MaterialListPage: React.FC = () => {
    const { projectId } = useParams();
    const { isLoadingMaterials, setMaterials } = useMaterials();
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);

    const fetchAssemblies = async () => {
        try {
            const response = await getWithAlert<AssemblyType[]>(`assembly/get-assemblies/${projectId}`);
            setAssemblies(response ?? []);
            return response ?? [];
        } catch (error) {
            console.error('Failed to fetch assemblies:', error);
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
        };

        initializeAssemblies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <ContentBlock>
            <ContentBlockHeader text={'Project Materials'} />
            <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />

            {assemblies.map(assembly => (
                <MaterialListContainer key={assembly.id} assembly={assembly} />
            ))}
        </ContentBlock>
    );
};

export default MaterialListPage;
