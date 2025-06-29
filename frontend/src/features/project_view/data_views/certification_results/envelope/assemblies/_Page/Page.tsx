import React, { useContext } from 'react';
import { Grid } from '@mui/material';

import { useMaterials } from '../../_contexts/MaterialsContext';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { AssemblyProvider, useAssemblyContext } from '../Assembly/Assembly.Context';
import { AssemblySidebarProvider } from '../Assembly/Sidebar/Sidebar.Context';

import LoadingModal from '../../../../_components/LoadingModal';
import ContentBlockHeader from '../../../../_components/ContentBlock.Header';
import ContentBlock from '../../../../_components/ContentBlock';
import { headerButtons } from './HeaderButtons';
import AssemblyEditButtons from '../Assembly/Assembly.EditButtons';
import Assembly from '../Assembly/Assembly';
import AssemblySidebar from '../Assembly/Sidebar/Sidebar';
import { AssemblyType } from '../../_types/Assembly';

// Component to render the appropriate content based on loading state and data availability
const AssemblyView: React.FC<{ selectedAssembly: AssemblyType | null }> = ({ selectedAssembly }) => {
    const assemblyContext = useAssemblyContext();

    if (assemblyContext.isLoadingAssemblies) {
        return <p>Loading...</p>;
    }

    if (!selectedAssembly) {
        return <p>No assemblies available.</p>;
    }

    if (selectedAssembly.layers.length === 0) {
        return <p>No layers found.</p>;
    }

    return <Assembly assembly={selectedAssembly} />;
};

const AssemblyContentBlock: React.FC = () => {
    const userContext = useContext(UserContext);
    const assemblyContext = useAssemblyContext();
    const materialContext = useMaterials();
    const {
        selectedAssembly,
        handleRefreshMaterials,
        handleUploadConstructions,
        handleDownloadConstructions,
        handleFileSelected,
    } = useAssemblyContext();

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
                    <AssemblyEditButtons />
                    <AssemblyView selectedAssembly={selectedAssembly} />
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
        <ContentBlock>
            <AssemblyProvider>
                <AssemblySidebarProvider>
                    <AssemblyContentBlock />
                </AssemblySidebarProvider>
            </AssemblyProvider>
        </ContentBlock>
    );
};

export default AssembliesPage;
