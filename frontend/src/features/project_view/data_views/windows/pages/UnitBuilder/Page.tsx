import { Box, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useApertures } from '../../_contexts/Aperture.Context';
import { ZoomProvider } from './ApertureView/Zoom.Context';
import { ViewDirectionProvider } from './ApertureView/ViewDirection.Context';
import { ApertureSidebarProvider, useApertureSidebar } from './Sidebar/Sidebar.Context';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureTypesSidebar from './Sidebar/Sidebar';
import ApertureSelector from './ApertureView/ApertureSelector';
import ApertureElements from './ApertureView/ElementsView/ApertureElements';
import ApertureElementsTable from './ElementsTable/ElementsTable';
import { useHeaderButtons } from './ApertureView/Aperture.HeaderButtons';

const SIDEBAR_WIDTH = 260;

const ApertureTypesContentBlock: React.FC = () => {
    const { activeAperture } = useApertures();
    const { isSidebarOpen, toggleSidebar } = useApertureSidebar();
    const headerButtons = useHeaderButtons();

    return (
        <ContentBlock id="aperture-types">
            <LoadingModal showModal={false} />

            <ContentBlockHeader
                id="aperture-types-header"
                text={`Window / Door Type`}
                buttons={headerButtons}
                titleContent={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <h4 style={{ margin: 0 }}>Window / Door Type</h4>
                        <ApertureSelector />
                    </Box>
                }
            />

            <Box id="aperture-types-active-view-container" sx={{ display: 'flex', margin: 2, position: 'relative' }}>
                {/* Collapsible Sidebar - uses overflow:hidden to "cover" content when collapsing */}
                <Box
                    id="aperture-types-sidebar"
                    sx={{
                        width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
                        minWidth: isSidebarOpen ? SIDEBAR_WIDTH : 0,
                        overflow: 'hidden',
                        transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
                        flexShrink: 0,
                    }}
                >
                    <Box sx={{ width: SIDEBAR_WIDTH }}>
                        <ApertureTypesSidebar />
                    </Box>
                </Box>

                {/* Toggle Button */}
                <Box
                    id="aperture-types-sidebar-toggle"
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        pt: 1,
                    }}
                >
                    <IconButton
                        id="aperture-types-sidebar-toggle-button"
                        onClick={toggleSidebar}
                        size="small"
                        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </Box>

                {/* Main Content */}
                <Box id="aperture-types-content" sx={{ flexGrow: 1, borderLeft: '1px solid #ccc', p: 2, pt: 0 }}>
                    <Box className="aperture-view">
                        <ApertureElements />
                        <ApertureElementsTable />
                    </Box>
                </Box>
            </Box>
        </ContentBlock>
    );
};

const ApertureTypesPage: React.FC = () => {
    return (
        <ZoomProvider>
            <ViewDirectionProvider>
                <ApertureSidebarProvider>
                    <ApertureTypesContentBlock />
                </ApertureSidebarProvider>
            </ViewDirectionProvider>
        </ZoomProvider>
    );
};

export default ApertureTypesPage;
