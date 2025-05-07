import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";

import MaterialsDataGrid from "./pages/Materials.DataGrid";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";


const AssemblyDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Materials", path: `${projectId}/material_layers` },
    ];

    return (
        <>
            <Box id="assemblies-data-dashboard">
                <DataDashboardTabBar
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(tabNumber) => setActiveTab(tabNumber)}
                />
                <DataViewPage>
                    <ContentBlock>
                        {activeTab === 0 && <MaterialsDataGrid />}
                    </ContentBlock>
                </DataViewPage>
            </Box>
        </>
    )
}

export default AssemblyDataDashboard;