import { Box, CircularProgress, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { useApertures } from '../../_contexts/Aperture.Context';
import { useFrameTypes } from '../../_contexts/FrameType.Context';
import { useGlazingTypes } from '../../_contexts/GlazingTypes.Context';
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
import { useApertureUValue } from './hooks/useApertureUValue';
import UValueLabel from './components/UValueLabel';

const SIDEBAR_WIDTH = 260;

const ApertureTypesContentBlock: React.FC = () => {
    const { activeAperture } = useApertures();
    const { isSidebarOpen, toggleSidebar } = useApertureSidebar();
    const { isLoadingFrameTypes } = useFrameTypes();
    const { isLoadingGlazingTypes } = useGlazingTypes();
    const headerButtons = useHeaderButtons();
    const { uValueData, loading: uValueLoading, error: uValueError } = useApertureUValue(activeAperture);

    const isRefreshing = isLoadingFrameTypes || isLoadingGlazingTypes;

    const headerButtonsWithUValue = [
        <UValueLabel
            key="window-u-value"
            uValue={uValueData?.u_value_w_m2k ?? null}
            loading={uValueLoading}
            error={uValueError}
            isValid={uValueData?.is_valid ?? true}
        />,
        ...headerButtons,
    ];

    return (
        <ContentBlock id="aperture-types">
            <LoadingModal showModal={false} />

            {/* Loading overlay during refresh operations */}
            {isRefreshing && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                    }}
                >
                    <CircularProgress size={40} />
                    <Box sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {isLoadingFrameTypes ? 'Refreshing frame types...' : 'Refreshing glazing types...'}
                    </Box>
                </Box>
            )}

            <ContentBlockHeader
                id="aperture-types-header"
                text={`Window / Door Type`}
                buttons={headerButtonsWithUValue}
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
