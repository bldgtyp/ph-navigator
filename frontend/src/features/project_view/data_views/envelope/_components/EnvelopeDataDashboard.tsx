import '../_styles/Assembly.css';
import '../_styles/Layer.css';
import '../_styles/Segment.css';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

import { MaterialsProvider } from '../_contexts/MaterialsContext';

import DataViewPage from '../../_components/DataViewPage';
import ContentBlocksContainer from '../../_components/ContentBlocks.Container';
import DataDashboardTabBar from '../../_components/DataDashboardTabBar';

const EnvelopeDataDashboard: React.FC = () => {
    const tabs = [
        { label: 'Materials', path: 'material-layers' },
        { label: 'Assemblies', path: 'assemblies' },
        { label: 'Airtightness', path: 'airtightness' },
    ];

    // Determine active tab from URL path
    const getActiveTabFromPath = () => {
        const path = location.pathname;
        if (path.includes('/material-layers')) return 0;
        if (path.includes('/assemblies')) return 1;
        if (path.includes('/airtightness')) return 2;
        return 0; // Default
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromPath());

    // Update active tab when URL changes
    useEffect(() => {
        setActiveTab(getActiveTabFromPath());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    return (
        <MaterialsProvider>
            <Box id="envelope-data-dashboard">
                <DataDashboardTabBar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={tabNumber => setActiveTab(tabNumber)}
                />

                <DataViewPage>
                    <ContentBlocksContainer>
                        <Outlet />
                    </ContentBlocksContainer>
                </DataViewPage>
            </Box>
        </MaterialsProvider>
    );
};

export default EnvelopeDataDashboard;
