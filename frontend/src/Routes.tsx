import { Routes, Route } from 'react-router-dom';
import Landing from "./Landing";
import Login from "./features/auth/components/Login";
import Projects from "./features/project_browser/components/Projects";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import Project from "./features/project_view/components/Project";
import Account from "./features/auth/components/Account";

const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/account" element={<Account />} />
        </Route>
        <Route path="/project/:projectId" element={<Project />} />
    </Routes>
);

export default AppRoutes;