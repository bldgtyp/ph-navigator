import React from 'react';
import { Grid } from '@mui/material';

import { AperturesProvider } from '../_contexts/ApertureContext';
import { ApertureSidebarProvider } from './Sidebar/Sidebar.Context';

import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import ApertureSidebar from './Sidebar/Sidebar';
import WindowUnitView from './WindowUnit/WindowUnit.View';

const WindowUnits: React.FC = () => {
    return (
        <AperturesProvider>
            <ApertureSidebarProvider>
                <ContentBlock>
                    <LoadingModal showModal={false} />

                    <ContentBlockHeader text="Window & Door Builder" />

                    <Grid container spacing={1} sx={{ margin: 2 }}>
                        {/* Sidebar Column */}
                        <Grid size={2}>
                            <ApertureSidebar />
                        </Grid>

                        {/* Main Window Unit View */}
                        <Grid p={2} size={10} sx={{ borderLeft: '1px solid #ccc' }}>
                            <WindowUnitView />
                        </Grid>
                    </Grid>
                </ContentBlock>
            </ApertureSidebarProvider>
        </AperturesProvider>
    );
};

export default WindowUnits;
