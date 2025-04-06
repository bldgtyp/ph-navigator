import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";

import { ProjectType, defaultProjectType } from "../../types/ProjectType";
import { fetchWithAlert } from "../../../api/fetchData";

import ProjectBar from "./ProjectBar";
import ProjectTabBar from "./ProjectTabBar";
import Viewer from "../model_viewer/Viewer";
import EquipmentDataDashboard from "../data_views/equipment/components/EquipmentDataDashboard";
import WindowDataDashboard from "../data_views/windows/components/WindowDataDashboard";
import AssemblyDataDashboard from "../data_views/assemblies/components/AssemblyDataDashboard";
import ProjectCertification from "../data_views/certification/components/Certification";


const ProjectContainer: React.FC = () => {
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

    return (
        <>
            {isLoading ? (
                <div>Loading Project Data</div>
            ) : (
                <>
                    <ProjectBar {...projectData} />
                    <ProjectTabBar
                        projectId={projectId!}
                        activeTabNumber={activeTab}
                        onTabChange={(tabNumber) => setActiveTab(tabNumber)}
                    />
                    <Box id="project-container" style={{ marginTop: "16px" }}>
                        {activeTab === 0 && <ProjectCertification />}
                        {activeTab === 1 && <WindowDataDashboard />}
                        {activeTab === 2 && <AssemblyDataDashboard />}
                        {activeTab === 3 && <EquipmentDataDashboard />}
                        {activeTab === 4 && <Viewer {...projectData} />}
                    </Box>
                </>
            )}
        </>
    )
}

export default ProjectContainer;