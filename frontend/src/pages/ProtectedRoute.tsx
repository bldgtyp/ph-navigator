import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { UserContext, UserContextType } from "../contexts/UserContext";

const ProtectedRoute = () => {
    const userContext = useContext(UserContext) as UserContextType;
    return userContext.user ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;