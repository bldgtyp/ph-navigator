import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DataViewPage from "../../shared/components/DataViewPage";
import { fetchWithModal } from "../../../../../hooks/fetchUserData";
import EquipmentDataDashboardTabBar from "./EquipmentDataDashboardTabBar";
import ContentBlock from "../../shared/components/ContentBlock";
import FanDataGrid from "./FanDataGrid";
import PumpDataGrid from "./PumpDataGrid";
import HotWaterTankDataGrid from "./HotWaterTanksDataGrid";
import LightingDataGrid from "./LightingDataGrid";
import AppliancesDataGrid from "./AppliancesDataGrid";
import { ProjectType, defaultProjectType } from "../../../../../types/database/Project";


export default function EquipmentDataDashboard(params: any) {
    const { projectId } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [projectData, setProjectData] = useState<ProjectType>(defaultProjectType);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        async function loadProjectData() {
            try {
                const d = await fetchWithModal<ProjectType>(`project/${projectId}`)
                setProjectData(d || defaultProjectType)
            } catch (error) {
                alert("Error loading project data. Please try again later.");
                console.error("Error loading project data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadProjectData();
    }, [projectId])

    const handleTabChange = (newTab: number) => {
        setActiveTab(newTab);
    };

    return (
        <>
            {isLoading ? (
                <div>Loading Project Data</div>
            ) : (
                <div>
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
                </div>
            )}
        </>
    )
}