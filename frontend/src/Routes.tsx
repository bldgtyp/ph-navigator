import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Landing from "./Landing";
import Login from "./features/auth/components/Login";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import Account from "./features/auth/components/Account";
import Projects from "./features/project_browser/components/Projects";
import ProjectContainer from "./features/project_view/components/ProjectContainer";
import Settings from './features/project_browser/components/Settings';


const AppRoutes: React.FC = () => (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/account" element={<Account />} />
            <Route path="//project/:projectId/settings" element={<Settings />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectContainer />} />
    </Routes>
);

export default AppRoutes;