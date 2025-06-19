import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Landing from './Landing';
import Login from './features/auth/_components/Login';
import ProtectedRoute from './features/auth/_components/ProtectedRoute';
import Account from './features/auth/_components/Account';
import Projects from './features/project_browser/_components/Projects';
import ProjectContainer from './features/project_view/_components/ProjectContainer';
import Settings from './features/project_browser/_components/Settings';
import ProjectStatus from './features/project_view/data_views/project_status/Page';
import WindowDataDashboard from './features/project_view/data_views/windows/components/WindowDataDashboard';
import EnvelopeDataDashboard from './features/project_view/data_views/envelope/_components/EnvelopeDataDashboard';
import EquipmentDataDashboard from './features/project_view/data_views/equipment/components/EquipmentDataDashboard';
import Viewer from './features/project_view/model_viewer/Viewer';
import WindowUnitDataGrid from './features/project_view/data_views/windows/components/pages/WindowUnit.DataGrid';
import FrameTypesDataGrid from './features/project_view/data_views/windows/components/pages/Frames.DataGrid';
import GlazingTypesDataGrid from './features/project_view/data_views/windows/components/pages/Glazing.DataGrid';
import MaterialListPage from './features/project_view/data_views/envelope/material_list/Page';
import AssembliesPage from './features/project_view/data_views/envelope/assemblies/_Page/Page';
import ErvDataGrid from './features/project_view/data_views/equipment/components/pages/Ervs.DataGrid';
import PumpDataGrid from './features/project_view/data_views/equipment/components/pages/Pumps.DataGrid';
import HotWaterTankDataGrid from './features/project_view/data_views/equipment/components/pages/HotWaterTanks.DataGrid';
import FanDataGrid from './features/project_view/data_views/equipment/components/pages/Fans.DataGrid';
import LightingDataGrid from './features/project_view/data_views/equipment/components/pages/Lighting.DataGrid';
import AppliancesDataGrid from './features/project_view/data_views/equipment/components/pages/Appliances.DataGrid';
import AirtightnessPage from './features/project_view/data_views/envelope/airtightness/Page';

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
            <Route index element={<ProjectStatus />} />
            <Route path="status" element={<ProjectStatus />} />

            <Route path="window-data" element={<WindowDataDashboard />}>
                <Route index element={<Navigate to="window-glazing-types" replace />} />
                <Route path="window-glazing-types" element={<GlazingTypesDataGrid />} />
                <Route path="window-frame-types" element={<FrameTypesDataGrid />} />
                <Route path="window-unit-type" element={<WindowUnitDataGrid />} />
            </Route>

            <Route path="envelope-data" element={<EnvelopeDataDashboard />}>
                <Route index element={<Navigate to="material-layers" replace />} />
                <Route path="material-layers" element={<MaterialListPage />} />
                <Route path="assemblies" element={<AssembliesPage />} />
                <Route path="airtightness" element={<AirtightnessPage />} />
            </Route>

            <Route path="equipment-data" element={<EquipmentDataDashboard />}>
                <Route index element={<Navigate to="erv-units" replace />} />
                <Route path="erv-units" element={<ErvDataGrid />} />
                <Route path="pumps" element={<PumpDataGrid />} />
                <Route path="dhw-tanks" element={<HotWaterTankDataGrid />} />
                <Route path="fans" element={<FanDataGrid />} />
                <Route path="lighting" element={<LightingDataGrid />} />
                <Route path="appliances" element={<AppliancesDataGrid />} />
            </Route>

            <Route path="model" element={<Viewer />} />
        </Route>
    </Routes>
);

export default AppRoutes;
