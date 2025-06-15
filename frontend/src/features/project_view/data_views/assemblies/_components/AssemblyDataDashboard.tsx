import '../styles/Assembly.css';
import '../styles/Layer.css';
import '../styles/Segment.css';
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";

import { MaterialsProvider } from "../_contexts/MaterialsContext";

import DataViewPage from "../../_components/DataViewPage";
import ContentBlock from "../../_components/ContentBlock";
import DataDashboardTabBar from "../../_components/DataDashboardTabBar";


const AssemblyDataDashboard: React.FC = () => {
    const tabs = [
        { label: "Materials", path: "material-layers" },
        { label: "Assemblies", path: "assemblies" },
    ];

    // Determine active tab from URL path
    const getActiveTabFromPath = () => {
        const path = location.pathname;
        if (path.includes('/material-layers')) return 0;
        if (path.includes('/assemblies')) return 1;
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
            <Box id="assemblies-data-dashboard">
                <DataDashboardTabBar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(tabNumber) => setActiveTab(tabNumber)}
                />

                <DataViewPage>
                    <ContentBlock>
                        <Outlet />
                    </ContentBlock>
                </DataViewPage>

            </Box>
        </MaterialsProvider>
    )
}

export default AssemblyDataDashboard;