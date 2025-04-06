import { useState } from "react";
import { useParams } from "react-router-dom";

import FanDataGrid from "./pages/FanDataGrid";
import PumpDataGrid from "./pages/PumpDataGrid";
import HotWaterTankDataGrid from "./pages/HotWaterTanksDataGrid";
import LightingDataGrid from "./pages/LightingDataGrid";
import AppliancesDataGrid from "./pages/AppliancesDataGrid";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";

const EquipmentDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Pumps", path: `${projectId}/pumps` },
        { label: "Tanks", path: `${projectId}/dhw_tanks` },
        { label: "Fans", path: `${projectId}/fans` },
        { label: "Lighting", path: `${projectId}/lighting` },
        { label: "Appliances", path: `${projectId}/appliances` },
    ];

    return (
        <>
            <DataDashboardTabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(tabNumber) => setActiveTab(tabNumber)}
            />
            <DataViewPage>
                <ContentBlock>
                    {activeTab === 0 && <PumpDataGrid />}
                    {activeTab === 1 && <HotWaterTankDataGrid />}
                    {activeTab === 2 && <FanDataGrid />}
                    {activeTab === 3 && <LightingDataGrid />}
                    {activeTab === 4 && <AppliancesDataGrid />}
                </ContentBlock>
            </DataViewPage>
        </>
    )
}

export default EquipmentDataDashboard;