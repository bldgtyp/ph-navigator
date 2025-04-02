import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProjectType, defaultProjectType } from "../../types/database/Project";
import { fetchWithModal } from "../../hooks/fetchUserData";
import ProjectBar from "../../components/layout/ProjectBar";
import ProjectTabBar from "../../components/layout/ProjectTabBar";
import ProjectData from "./InputData";
import Project3DModel from "./Model";
import ProjectCertification from "./Certification";

export default function Project() {
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
                    <ProjectBar {...projectData} />
                    <ProjectTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
                    <div style={{ marginTop: "16px" }}>
                        {activeTab === 0 && <ProjectCertification {...projectData} />}
                        {activeTab === 1 && <ProjectData {...projectData} />}
                        {activeTab === 2 && <Project3DModel {...projectData} />}
                    </div>
                </div>
            )}
        </>
    )
}