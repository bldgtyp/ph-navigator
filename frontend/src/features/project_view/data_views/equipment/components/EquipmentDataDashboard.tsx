import { useState } from "react";
import { useParams } from "react-router-dom";

import FanDataGrid from "./pages/Fans.DataGrid";
import PumpDataGrid from "./pages/Pumps.DataGrid";
import HotWaterTankDataGrid from "./pages/HotWaterTanks.DataGrid";
import LightingDataGrid from "./pages/Lighting.DataGrid";
import AppliancesDataGrid from "./pages/Appliances.DataGrid";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";
import ErvDataGrid from "./pages/Ervs.DataGrid";

const EquipmentDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Ventilation", path: `${projectId}/erv_units` },
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
                    {activeTab === 0 && <ErvDataGrid />}
                    {activeTab === 1 && <PumpDataGrid />}
                    {activeTab === 2 && <HotWaterTankDataGrid />}
                    {activeTab === 3 && <FanDataGrid />}
                    {activeTab === 4 && <LightingDataGrid />}
                    {activeTab === 5 && <AppliancesDataGrid />}
                </ContentBlock>
            </DataViewPage>
        </>
    )
}

export default EquipmentDataDashboard;