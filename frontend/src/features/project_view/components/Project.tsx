import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProjectType, defaultProjectType } from "../../types/Project";
import { fetchWithAlert } from "../../../api/fetchData";
import ProjectBar from "./ProjectBar";
import ProjectTabBar from "./ProjectTabBar";
import EquipmentDataDashboard from "../data_views/equipment/components/EquipmentDataDashboard";
import WindowDataDashboard from "../data_views/windows/components/WindowDataDashboard";
import AssemblyDataDashboard from "../data_views/assemblies/components/AssemblyDataDashboard";
import Viewer from "../model_viewer/Viewer";
import ProjectCertification from "../data_views/certification/components/Certification";

export default function Project() {
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
                    <ProjectBar {...projectData} />
                    <ProjectTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
                    <div style={{ marginTop: "16px" }}>
                        {activeTab === 0 && <ProjectCertification {...projectData} />}
                        {activeTab === 1 && <WindowDataDashboard {...projectData} />}
                        {activeTab === 2 && <AssemblyDataDashboard {...projectData} />}
                        {activeTab === 3 && <EquipmentDataDashboard {...projectData} />}
                        {activeTab === 4 && <Viewer {...projectData} />}
                    </div>
                </div>
            )}
        </>
    )
}