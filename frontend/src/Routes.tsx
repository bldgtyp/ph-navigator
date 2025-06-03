import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Landing from "./Landing";
import Login from "./features/auth/components/Login";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import Account from "./features/auth/components/Account";
import Projects from "./features/project_browser/components/Projects";
import ProjectContainer from "./features/project_view/components/ProjectContainer";
import Settings from './features/project_browser/components/Settings';
import ProjectCertification from './features/project_view/data_views/certification/components/Certification';
import WindowDataDashboard from './features/project_view/data_views/windows/components/WindowDataDashboard';
import AssemblyDataDashboard from './features/project_view/data_views/assemblies/components/AssemblyDataDashboard';
import EquipmentDataDashboard from './features/project_view/data_views/equipment/components/EquipmentDataDashboard';
import Viewer from './features/project_view/model_viewer/Viewer';
import WindowUnitDataGrid from './features/project_view/data_views/windows/components/pages/WindowUnit.DataGrid';
import FrameTypesDataGrid from './features/project_view/data_views/windows/components/pages/Frames.DataGrid';
import GlazingTypesDataGrid from './features/project_view/data_views/windows/components/pages/Glazing.DataGrid';


const AppRoutes: React.FC = () => (
    <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/account" element={<Account />} />
            <Route path="/project/:projectId/settings" element={<Settings />} />
        </Route>

        <Route path="/project/:projectId" element={<ProjectContainer />}>
            <Route index element={<ProjectCertification />} />
            <Route path="certification" element={<ProjectCertification />} />
            <Route path="window-data" element={<WindowDataDashboard />}>
                <Route path="window-glazing-types" element={<GlazingTypesDataGrid />} />
                <Route path="window-frame-types" element={<FrameTypesDataGrid />} />
                <Route path="window-unit-type" element={<WindowUnitDataGrid />} />
            </Route>
            <Route path="assembly-data" element={<AssemblyDataDashboard />} />
            <Route path="equipment-data" element={<EquipmentDataDashboard />} />
            <Route path="model" element={<Viewer />} />
        </Route>

    </Routes>
);

export default AppRoutes;