import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import DataViewPage from '../_components/DataViewPage';
import ContentBlocksContainer from '../_components/ContentBlocks.Container';
import DataDashboardTabBar from '../_components/DataDashboardTabBar';
import { AperturesProvider } from './_contexts/Aperture.Context';
import { FrameTypesProvider } from './_contexts/FrameType.Context';
import { GlazingTypesProvider } from './_contexts/GlazingTypes.Context';

const WindowDataDashboard: React.FC = () => {
    const tabs = [
        { label: 'Glazing Types', path: 'window-glazing-types' },
        { label: 'Frame Types', path: 'window-frame-types' },
        { label: 'Unit Types', path: 'window-unit-type' },
        { label: 'Unit Builder', path: 'window-unit-builder' },
    ];

    // Determine active tab from URL path
    const getActiveTabFromPath = () => {
        const path = location.pathname;
        if (path.includes('/window-glazing-types')) return 0;
        if (path.includes('/window-frame-types')) return 1;
        if (path.includes('/window-unit-type')) return 2;
        if (path.includes('/window-unit-builder')) return 3;
        return 0; // Default
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromPath());

    // Update active tab when URL changes
    useEffect(() => {
        setActiveTab(getActiveTabFromPath());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    return (
        <>
            <DataDashboardTabBar tabs={tabs} activeTab={activeTab} onTabChange={tabNumber => setActiveTab(tabNumber)} />
            <AperturesProvider>
                <FrameTypesProvider>
                    <GlazingTypesProvider>
                        <DataViewPage>
                            <ContentBlocksContainer>
                                <Outlet />
                            </ContentBlocksContainer>
                        </DataViewPage>
                    </GlazingTypesProvider>
                </FrameTypesProvider>
            </AperturesProvider>
        </>
    );
};

export default WindowDataDashboard;
