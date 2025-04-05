import { useState } from "react";
import { useParams } from "react-router-dom";
import DataViewPage from "../../shared/components/DataViewPage";
import EquipmentDataDashboardTabBar from "./EquipmentDataDashboardTabBar";
import ContentBlock from "../../shared/components/ContentBlock";
import FanDataGrid from "./FanDataGrid";
import PumpDataGrid from "./PumpDataGrid";
import HotWaterTankDataGrid from "./HotWaterTanksDataGrid";
import LightingDataGrid from "./LightingDataGrid";
import AppliancesDataGrid from "./AppliancesDataGrid";


const EquipmentDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (newTab: number) => {
        setActiveTab(newTab);
    };

    return (
        <>
            <EquipmentDataDashboardTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
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