import { useEffect, useState } from "react";
import { useParams, useLocation, Outlet } from "react-router-dom";
import Box from "@mui/material/Box";

import { ProjectType, defaultProjectType } from "../../types/ProjectType";
import { getWithAlert } from "../../../api/getWithAlert";

import ProjectBar from "./ProjectBar";
import ProjectTabBar from "./ProjectTabBar";


const ProjectContainer: React.FC = () => {
    const { projectId } = useParams();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const [projectData, setProjectData] = useState<ProjectType>(defaultProjectType);

    // Determine active tab from URL path
    const getActiveTabFromPath = () => {
        const path = location.pathname;
        if (path.includes('/certification')) return 0;
        if (path.includes('/window_data')) return 1;
        if (path.includes('/assembly_data')) return 2;
        if (path.includes('/equipment_data')) return 3;
        if (path.includes('/model')) return 4;
        return 0; // Default to certification if path doesn't match any tab
    };

    const [activeTab, setActiveTab] = useState(getActiveTabFromPath());

    // Update active tab when URL changes
    useEffect(() => {
        setActiveTab(getActiveTabFromPath());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Load project data when component mounts
    useEffect(() => {
        async function loadProjectData() {
            try {
                const d = await getWithAlert<ProjectType>(`project/${projectId}`)
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
                    <Box id="project-container">
                        <Outlet context={projectData} />
                    </Box>
                </>
            )}
        </>
    )
}

export default ProjectContainer;