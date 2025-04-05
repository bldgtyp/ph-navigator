import { useState } from "react";
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";
import DataViewPage from "../../shared/components/DataViewPage";
import AssembliesDataDashboardTabBar from "./AssembliesDataDashboardTabBar";
import ContentBlock from "../../shared/components/ContentBlock";
import MaterialsDataGrid from "./MaterialsDataGrid";


const AssemblyDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (newTab: number) => {
        setActiveTab(newTab);
    };

    return (
        <>
            <Box id="assemblies-data-dashboard">
                <AssembliesDataDashboardTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
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