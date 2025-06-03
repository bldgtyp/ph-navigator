import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";

const EquipmentDataDashboard: React.FC = () => {
    const tabs = [
        { label: "Ventilation", path: "erv-units" },
        { label: "Pumps", path: "pumps" },
        { label: "Tanks", path: "dhw-tanks" },
        { label: "Fans", path: "fans" },
        { label: "Lighting", path: "lighting" },
        { label: "Appliances", path: "appliances" },
    ];

    // Determine active tab from URL path
    const getActiveTabFromPath = () => {
        const path = location.pathname;
        if (path.includes('/erv-units')) return 0;
        if (path.includes('/pumps')) return 1;
        if (path.includes('/dhw-tanks')) return 2;
        if (path.includes('/fans')) return 3;
        if (path.includes('/lighting')) return 4;
        if (path.includes('/appliances')) return 5;
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
        </>
    )
}

export default EquipmentDataDashboard;