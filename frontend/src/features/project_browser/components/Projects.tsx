import { useContext, useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { UserContext } from "../../auth/contexts/UserContext";
import { fetchWithAlert } from "../../../api/fetchData";
import { ProjectType, defaultProjectType } from "../../types/Project";
import ProjectCard from "./ProjectCard";

export default function Projects() {
    const userContext = useContext(UserContext);
    const [isLoading, setIsLoading] = useState(true);
    const [projectCardData, setProjectCardData] = useState<ProjectType[]>([defaultProjectType]);

    useEffect(() => {
        async function loadProjectCardData() {
            try {
                const projectCardData = await fetchWithAlert<ProjectType[]>("project_browser/get_project_card_data")
                setProjectCardData(projectCardData || [])
            } catch (error) {
                alert("Error loading project data. Please try again later.");
                console.error("Error loading project data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadProjectCardData();

    }, [userContext]);

    return (
        <Stack id="projects" spacing={2} sx={{ m: 3 }}>
            {!isLoading && (
                <Grid container spacing={3}>
                    {projectCardData.map((p) => {
                        return <ProjectCard {...p} key={p.id} />;
                    })}
                </Grid>
            )}
        </Stack>
    );
}