import { useContext } from 'react';
import { Box, Grid } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { AperturesProvider, useApertures } from './ApertureView/Aperture.Context';
import { ZoomProvider } from './ApertureView/Zoom.Context';
import { ApertureSidebarProvider } from './Sidebar/Sidebar.Context';
import { FrameTypesProvider } from './ElementsTable/FrameType.Context';
import { GlazingTypesProvider } from './ElementsTable/GlazingTypes.Context';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureTypesSidebar from './Sidebar/Sidebar';
import ApertureEditButtons from './ApertureView/Aperture.EditButtons';
import ApertureElements from './ApertureView/ElementsView/ApertureElements';
import ApertureElementsTable from './ElementsTable/ElementsTable';
import { useHeaderButtons } from './ApertureView/Aperture.HeaderButtons';

const ApertureTypesContentBlock: React.FC = () => {
    const userContext = useContext(UserContext);
    const { activeAperture } = useApertures();
    const headerButtons = useHeaderButtons(); // Always call the hook
    const headerButtonsConfig = userContext.user ? headerButtons : []; // Then conditionally use the result

    return (
        <ContentBlock id="aperture-types">
            <LoadingModal showModal={false} />

            <ContentBlockHeader text={`Window / Door Type [${activeAperture?.name}]`} buttons={headerButtonsConfig} />

            <Grid container spacing={1} sx={{ margin: 2 }}>
                {/* Sidebar Column */}
                <Grid size={3}>
                    <ApertureTypesSidebar />
                </Grid>

                {/* Main Window Unit View */}
                <Grid p={2} size={9} sx={{ borderLeft: '1px solid #ccc' }}>
                    <Box className="aperture-view">
                        {userContext.user ? <ApertureEditButtons /> : null}
                        <ApertureElements />
                        <ApertureElementsTable />
                    </Box>
                </Grid>
            </Grid>
        </ContentBlock>
    );
};

const ApertureTypesPage: React.FC = () => {
    return (
        <AperturesProvider>
            <ZoomProvider initialScale={0.5} minScale={0.1} maxScale={3.0} zoomStep={0.1}>
                <ApertureSidebarProvider>
                    <FrameTypesProvider>
                        <GlazingTypesProvider>
                            <ApertureTypesContentBlock />
                        </GlazingTypesProvider>
                    </FrameTypesProvider>
                </ApertureSidebarProvider>
            </ZoomProvider>
        </AperturesProvider>
    );
};

export default ApertureTypesPage;
