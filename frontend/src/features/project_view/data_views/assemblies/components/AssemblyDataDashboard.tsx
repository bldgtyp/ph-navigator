import '../styles/Assembly.css';
import '../styles/Layer.css';
import '../styles/Segment.css';
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Button } from "@mui/material";

import { MaterialsProvider } from "../contexts/MaterialsContext";
import { AssembliesProvider } from "../contexts/AssembliesContext";

import MaterialsDataGrid from "./pages/MaterialLayers.DataGrid";
import AssembliesPage from "./assemblies/Page";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";
import { getWithAlert } from "../../../../../api/getWithAlert";


const AssemblyDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Materials", path: `${projectId}/material_layers` },
        { label: "Constructions", path: `${projectId}/constructions` },
    ];

    const handleOnClick = () => {
        try {
            getWithAlert('assembly/load_materials_from_air_table');
        }
        catch (error) {
            alert("Error loading Material Data. Please try again later.");
            console.error("Error loading Material Data:", error);
        }
    }

    return (
        <MaterialsProvider>
            <AssembliesProvider>
                <Box id="assemblies-data-dashboard">
                    <DataDashboardTabBar
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(tabNumber) => setActiveTab(tabNumber)}
                    />
                    <Button variant="contained" color="info" size="small" sx={{ marginLeft: 8, marginTop: 2 }} onClick={handleOnClick}>Refresh Materials</Button>
                    <DataViewPage>
                        <ContentBlock>
                            {activeTab === 0 && <MaterialsDataGrid />}
                            {activeTab === 1 && <AssembliesPage />}
                        </ContentBlock>
                    </DataViewPage>
                </Box>
            </AssembliesProvider>
        </MaterialsProvider>
    )
}

export default AssemblyDataDashboard;