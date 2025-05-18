import '../styles/Assembly.css';
import '../styles/Layer.css';
import '../styles/Segment.css';
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";

import { MaterialsProvider } from "../contexts/MaterialsContext";

import MaterialsPage from "./materials/Page";
import AssembliesPage from "./assemblies/Page";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";


const AssemblyDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Materials", path: `${projectId}/material_layers` },
        { label: "Assemblies", path: `${projectId}/assemblies` },
    ];

    return (
        <MaterialsProvider>
            <Box id="assemblies-data-dashboard">
                <DataDashboardTabBar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(tabNumber) => setActiveTab(tabNumber)}
                />

                <DataViewPage>
                    <ContentBlock>
                        {activeTab === 0 && <MaterialsPage />}
                        {activeTab === 1 && <AssembliesPage />}
                    </ContentBlock>
                </DataViewPage>

            </Box>
        </MaterialsProvider>
    )
}

export default AssemblyDataDashboard;