import React from 'react';
import { Box, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useMaterials } from '../../_contexts/MaterialsContext';
import { AssemblyProvider, useAssemblyContext } from '../Assembly/Assembly.Context';
import { AssemblySidebarProvider, useAssemblySidebar } from '../Assembly/Sidebar/Sidebar.Context';

import LoadingModal from '../../../_components/LoadingModal';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import ContentBlock from '../../../_components/ContentBlock';
import { useAssemblyHeaderButtons } from './useAssemblyHeaderButtons';
import AssemblySelector from './AssemblySelector';
import AssemblyToolbar from '../Assembly/AssemblyToolbar';
import Assembly from '../Assembly/Assembly';
import AssemblySidebar from '../Assembly/Sidebar/Sidebar';
import { AssemblyType } from '../../_types/Assembly';

const SIDEBAR_WIDTH = 260;

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
    const assemblyContext = useAssemblyContext();
    const materialContext = useMaterials();
    const { isSidebarOpen, toggleSidebar } = useAssemblySidebar();
    const { selectedAssembly, handleFileSelected } = useAssemblyContext();
    const headerButtons = useAssemblyHeaderButtons();

    return (
        <>
            <LoadingModal showModal={materialContext.isLoadingMaterials || assemblyContext.isLoadingAssemblies} />

            <ContentBlockHeader
                text="Assembly Details"
                buttons={headerButtons}
                titleContent={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <h4 style={{ margin: 0 }}>Assembly Details</h4>
                        <AssemblySelector />
                    </Box>
                }
            />

            <Box id="assemblies-active-view-container" sx={{ display: 'flex', margin: 2, position: 'relative' }}>
                {/* Collapsible Sidebar */}
                <Box
                    id="assemblies-sidebar"
                    sx={{
                        width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
                        minWidth: isSidebarOpen ? SIDEBAR_WIDTH : 0,
                        overflow: 'hidden',
                        transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ width: SIDEBAR_WIDTH }}>
                        <AssemblySidebar />
                    </Box>
                </Box>

                {/* Toggle Button */}
                <Box
                    id="assemblies-sidebar-toggle"
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        pt: 1,
                    }}
                >
                    <IconButton
                        id="assemblies-sidebar-toggle-button"
                        onClick={toggleSidebar}
                        size="small"
                        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </Box>

                {/* Main Content */}
                <Box id="assemblies-content" sx={{ flexGrow: 1, borderLeft: '1px solid #ccc', p: 2, pt: 0 }}>
                    <AssemblyToolbar />
                    <AssemblyView selectedAssembly={selectedAssembly} />
                </Box>
            </Box>

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
