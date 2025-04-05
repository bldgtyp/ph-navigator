import { useState } from "react";
import { useParams } from "react-router-dom";
import DataViewPage from "../../shared/components/DataViewPage";
import WindowDataDashboardTabBar from "./WindowDataDashboardTabBar";
import ContentBlock from "../../shared/components/ContentBlock";
import FrameTypesDataGrid from "./FrameTypesDataGrid";
import GlazingTypesDataGrid from "./GlazingTypesDataGrid";
import WindowUnitDataGrid from "./WindowUnitDataGrid";


const WindowDataDashboard: React.FC = () => {
    const { projectId } = useParams();
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (newTab: number) => {
        setActiveTab(newTab);
    };

    return (
        <>
            <WindowDataDashboardTabBar projectId={projectId!} activeTab={activeTab} onTabChange={handleTabChange} />
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