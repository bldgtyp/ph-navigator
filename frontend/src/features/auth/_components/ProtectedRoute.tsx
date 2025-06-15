import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { UserContext } from "../_contexts/UserContext";
import { UserContextType } from "../../types/UserType";

const ProtectedRoute: React.FC = () => {
    const userContext = useContext(UserContext) as UserContextType;

    // If userContext.user is null, but a token DOES exist, show a loading state
    // It may take time to get the current user's data
    if (!userContext.user && localStorage.getItem("token")) {
        return <div>Loading...</div>;
    }

    // Redirect to login if no user is present
    return userContext.user ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;