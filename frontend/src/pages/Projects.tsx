import { useContext, useEffect, useState } from "react";
import { UserContext } from "../contexts/UserContext";
import { fetchWithModal } from "../hooks/fetchUserData";
import { Project } from "../types/database/Project";
import ProjectCard from "../components/ProjectCard";

const defaultProjectCardData = {
    name: "",
    id: "",
    bt_number: "",
    phius_number: "",
    airtable_base: "",
    owner_id: "",
    user_ids: "",
    airtable_base_ref: "",
    airtable_base_url: "",
}

function Projects() {
    const userContext = useContext(UserContext);
    const [isLoading, setIsLoading] = useState(true);
    const [projectCardData, setProjectCardData] = useState<Project[]>([defaultProjectCardData]);

    useEffect(() => {
        async function loadProjectCardData() {
            try {
                const projectCardData = await fetchWithModal<Project[]>("get_project_card_data")
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
        <div>
            <div>User:</div>
            {userContext && userContext.user ? (
                <div>
                    <div>ID: {userContext.user.id}</div>
                    <div>Username: {userContext.user.username}</div>
                    <div>Email: {userContext.user.email}</div>
                </div>
            ) : (
                <div>Loading user data...</div>
            )}

            <div>Projects:</div>
            {!isLoading && (
                <>
                    {projectCardData.map((d) => {
                        return <ProjectCard {...d} key={d.id} />;
                    })}
                </>
            )}

        </div>
    );
}

export default Projects;