import { useState } from "react";
import { useParams } from "react-router-dom";

import FrameTypesDataGrid from "./pages/Frames.DataGrid";
import GlazingTypesDataGrid from "./pages/Glazing.DataGrid";
import WindowUnitDataGrid from "./pages/WindowUnit.DataGrid";
import DataViewPage from "../../shared/components/DataViewPage";
import ContentBlock from "../../shared/components/ContentBlock";
import DataDashboardTabBar from "../../shared/components//DataDashboardTabBar";

const WindowDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { label: "Glazing Types", path: `${projectId}/glazing_types` },
        { label: "Frame Types", path: `${projectId}/frame_types` },
        { label: "Unit Types", path: `${projectId}/window_unit_type` },
    ];

    return (
        <>
            <DataDashboardTabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(tabNumber) => setActiveTab(tabNumber)} />
            <DataViewPage>
                <ContentBlock>
                    {activeTab === 0 && <GlazingTypesDataGrid />}
                    {activeTab === 1 && <FrameTypesDataGrid />}
                    {activeTab === 2 && <WindowUnitDataGrid />}
                </ContentBlock>
            </DataViewPage>
        </>
    )
}

export default WindowDataDashboard;