import React, { useContext } from 'react';
import { Box, Grid } from '@mui/material';

import { AperturesProvider, useApertures } from './ApertureView/Aperture.Context';
import { ApertureSidebarProvider } from './Sidebar/Sidebar.Context';
import { UserContext } from '../../../../../auth/_contexts/UserContext';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureTypesSidebar from './Sidebar/Sidebar';
import ApertureEditButtons from './ApertureView/Aperture.EditButtons';
import ApertureElements from './ApertureView/ApertureElements';

const ApertureTypesContentBlock: React.FC = () => {
    const userContext = useContext(UserContext);
    const { activeAperture } = useApertures();

    return (
        <ContentBlock id="aperture-types">
            <LoadingModal showModal={false} />

            <ContentBlockHeader text={`Window / Door Type [${activeAperture?.name}]`} />

            <Grid container spacing={1} sx={{ margin: 2 }}>
                {/* Sidebar Column */}
                <Grid size={2}>
                    <ApertureTypesSidebar />
                </Grid>

                {/* Main Window Unit View */}
                <Grid p={2} size={10} sx={{ borderLeft: '1px solid #ccc' }}>
                    <Box className="aperture-view">
                        {userContext ? <ApertureEditButtons /> : null}
                        <ApertureElements />
                    </Box>
                </Grid>
            </Grid>
        </ContentBlock>
    );
};

const ApertureTypesPage: React.FC = () => {
    return (
        <AperturesProvider>
            <ApertureSidebarProvider>
                <ApertureTypesContentBlock />
            </ApertureSidebarProvider>
        </AperturesProvider>
    );
};

export default ApertureTypesPage;
