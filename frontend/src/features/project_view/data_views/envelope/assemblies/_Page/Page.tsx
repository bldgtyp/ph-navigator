import React, { useContext } from 'react';
import { Grid } from '@mui/material';

import { useMaterials } from '../../_contexts/MaterialsContext';
import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { AssemblyProvider, useAssembly } from '../_contexts/Assembly.Context';

import LoadingModal from '../../../_components/LoadingModal';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import ContentBlock from '../../../_components/ContentBlock';
import { headerButtons } from './HeaderButtons';
import AssemblyButtons from '../Assembly/Assembly.Buttons';
import AssemblyView from '../Assembly/Assembly.View';
import AssemblySidebar from '../Assembly/Assembly.Sidebar';
import { useLoadAssemblies } from '../_contexts/Assembly.Hooks';
import { AssemblyType } from '../../_types/Assembly';

type AssemblyDetailProps = {
    selectedAssembly: AssemblyType | null;
    isLoading: boolean;
};

// Component to render the appropriate content based on loading state and data availability
const AssemblyDetail: React.FC<AssemblyDetailProps> = ({ selectedAssembly, isLoading }) => {
    if (isLoading) {
        return <p>Loading...</p>;
    }

    if (!selectedAssembly) {
        return <p>No assemblies available.</p>;
    }

    if (selectedAssembly.layers.length === 0) {
        return <p>No layers found.</p>;
    }

    return <AssemblyView assembly={selectedAssembly} />;
};

const AssemblyContentBlock: React.FC = () => {
    const userContext = useContext(UserContext);
    const assemblyContext = useAssembly();
    const materialContext = useMaterials();
    const {
        selectedAssembly,
        handleRefreshMaterials,
        handleUploadConstructions,
        handleDownloadConstructions,
        handleFileSelected,
    } = useLoadAssemblies();

    const headerButtonsConfig = userContext.user
        ? headerButtons(
              handleRefreshMaterials,
              handleUploadConstructions,
              handleDownloadConstructions,
              assemblyContext.isRefreshing
          )
        : [];

    return (
        <>
            <LoadingModal showModal={materialContext.isLoadingMaterials || assemblyContext.isLoadingAssemblies} />

            <ContentBlockHeader
                text={`Assembly Details ${selectedAssembly ? `[ ${selectedAssembly.name} ]` : ''}`}
                buttons={headerButtonsConfig}
            />

            <Grid container spacing={1} sx={{ margin: 2 }}>
                {/* Sidebar Column */}
                <Grid size={2}>
                    <AssemblySidebar />
                </Grid>

                {/* Main Content Column */}
                <Grid size={10} sx={{ borderLeft: '1px solid #ccc' }}>
                    <AssemblyButtons />
                    <AssemblyDetail
                        selectedAssembly={selectedAssembly}
                        isLoading={assemblyContext.isLoadingAssemblies}
                    />
                </Grid>
            </Grid>

            {/* Hidden file input for uploads */}
            <input
                type="file"
                accept=".hbjson, .json"
                ref={assemblyContext.fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelected}
            />
        </>
    );
};

const AssembliesPage: React.FC = () => {
    return (
        <AssemblyProvider>
            <ContentBlock>
                <AssemblyContentBlock />
            </ContentBlock>
        </AssemblyProvider>
    );
};

export default AssembliesPage;
