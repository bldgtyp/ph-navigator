import { useContext } from 'react';
import { Box, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useApertures } from '../../_contexts/Aperture.Context';
import { ZoomProvider } from './ApertureView/Zoom.Context';
import { ApertureSidebarProvider, useApertureSidebar } from './Sidebar/Sidebar.Context';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureTypesSidebar from './Sidebar/Sidebar';
import ApertureEditButtons from './ApertureView/Aperture.EditButtons';
import ApertureSelector from './ApertureView/ApertureSelector';
import ApertureElements from './ApertureView/ElementsView/ApertureElements';
import ApertureElementsTable from './ElementsTable/ElementsTable';
import { useHeaderButtons } from './ApertureView/Aperture.HeaderButtons';

const SIDEBAR_WIDTH = 260;

const ApertureTypesContentBlock: React.FC = () => {
    const userContext = useContext(UserContext);
    const { activeAperture } = useApertures();
    const { isSidebarOpen, toggleSidebar } = useApertureSidebar();
    const headerButtons = useHeaderButtons();

    return (
        <ContentBlock id="aperture-types">
            <LoadingModal showModal={false} />

            <ContentBlockHeader text={`Window / Door Type [${activeAperture?.name}]`} buttons={headerButtons} />

            <Box sx={{ display: 'flex', margin: 2 }}>
                {/* Collapsible Sidebar - uses overflow:hidden to "cover" content when collapsing */}
                <Box
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
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        pt: 1,
                    }}
                >
                    <IconButton
                        onClick={toggleSidebar}
                        size="small"
                        title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </Box>

                {/* Main Content */}
                <Box sx={{ flexGrow: 1, borderLeft: '1px solid #ccc', p: 2 }}>
                    <Box className="aperture-view">
                        {/* Toolbar row with dropdown and edit buttons aligned */}
                        <Box
                            display="flex"
                            justifyContent="flex-start"
                            alignItems="center"
                            flexWrap="wrap"
                            gap={1}
                            mb={2}
                        >
                            <ApertureSelector />
                            {userContext.user ? <ApertureEditButtons /> : null}
                        </Box>
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
            <ApertureSidebarProvider>
                <ApertureTypesContentBlock />
            </ApertureSidebarProvider>
        </ZoomProvider>
    );
};

export default ApertureTypesPage;
