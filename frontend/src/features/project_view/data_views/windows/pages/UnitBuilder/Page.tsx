import React from 'react';
import { Grid } from '@mui/material';

import { AperturesProvider } from './ApertureView/Aperture.Context';
import { ApertureSidebarProvider } from './Sidebar/Sidebar.Context';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureTypesSidebar from './Sidebar/Sidebar';
import ApertureView from './ApertureView/Aperture.View';

const ApertureTypesPage: React.FC = () => {
    return (
        <AperturesProvider>
            <ApertureSidebarProvider>
                <ContentBlock id="aperture-types">
                    <LoadingModal showModal={false} />

                    <ContentBlockHeader text="Window & Door Builder" />

                    <Grid container spacing={1} sx={{ margin: 2 }}>
                        {/* Sidebar Column */}
                        <Grid size={2}>
                            <ApertureTypesSidebar />
                        </Grid>

                        {/* Main Window Unit View */}
                        <Grid p={2} size={10} sx={{ borderLeft: '1px solid #ccc' }}>
                            <ApertureView />
                        </Grid>
                    </Grid>
                </ContentBlock>
            </ApertureSidebarProvider>
        </AperturesProvider>
    );
};

export default ApertureTypesPage;
