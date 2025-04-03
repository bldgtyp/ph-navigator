import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DataViewPage from "../../shared/components/DataViewPage";
import { fetchWithAlert } from "../../../../../api/fetchData";
import WindowDataDashboardTabBar from "./WindowDataDashboardTabBar";
import ContentBlock from "../../shared/components/ContentBlock";
import FrameTypesDataGrid from "./FrameTypesDataGrid";
import GlazingTypesDataGrid from "./GlazingTypesDataGrid";
import WindowUnitDataGrid from "./WindowUnitDataGrid";
import { ProjectType, defaultProjectType } from "../../../../types/Project";


export default function WindowDataDashboard(params: any) {
    const { projectId } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [projectData, setProjectData] = useState<ProjectType>(defaultProjectType);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        async function loadProjectData() {
            try {
                const d = await fetchWithAlert<ProjectType>(`project/${projectId}`)
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
                    <WindowDataDashboardTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
                    <DataViewPage>
                        <ContentBlock>
                            {activeTab === 0 && <GlazingTypesDataGrid />}
                            {activeTab === 1 && <FrameTypesDataGrid />}
                            {activeTab === 2 && <WindowUnitDataGrid />}
                        </ContentBlock>
                    </DataViewPage>
                </div>
            )}
        </>
    )
}