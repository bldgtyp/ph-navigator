import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Page from "./Page";
import { fetchWithModal } from "../../hooks/fetchUserData";
import WindowDataDashboardTabBar from "../../components/layout/WindowDataDashboardTabBar";
import ContentBlock from "../../components/layout/ContentBlock";
import FrameTypesDataGrid from "../../components/tables/FrameTypesDataGrid";
import GlazingTypesDataGrid from "../../components/tables/GlazingTypesDataGrid";
import WindowUnitDataGrid from "../../components/tables/WindowUnitDataGrid";
import { ProjectType, defaultProjectType } from "../../types/database/Project";


export default function WindowDataDashboard(params: any) {
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
                    <WindowDataDashboardTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
                    <Page>
                        <ContentBlock>
                            {activeTab === 0 && <GlazingTypesDataGrid />}
                            {activeTab === 1 && <FrameTypesDataGrid />}
                            {activeTab === 2 && <WindowUnitDataGrid />}
                        </ContentBlock>
                    </Page>
                </div>
            )}
        </>
    )
}