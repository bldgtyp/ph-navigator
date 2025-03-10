import { useContext } from "react";
import { UserContext } from "../contexts/UserContext";

function Projects() {
    const userContext = useContext(UserContext);

    return (
        <div>
            <div>Projects</div>
            {userContext && userContext.user ? (
                <div>
                    <div>ID: {userContext.user.id}</div>
                    <div>Username: {userContext.user.username}</div>
                    <div>Email: {userContext.user.email}</div>
                </div>
            ) : (
                <div>Loading user data...</div>
            )}
        </div>
    );
}

export default Projects;