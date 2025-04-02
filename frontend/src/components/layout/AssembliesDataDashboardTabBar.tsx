import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Box from "@mui/material/Box";

type paramsType = {
    projectId: string;
    activeTab: number; // The active tab index managed by the parent
    onTabChange: (newTab: number) => void; // Callback function to notify parent of tab changes
}

export default function AssembliesDataDashboardTabBar({ projectId, activeTab, onTabChange }: paramsType) {
    const tabs = [
        { label: "Materials", path: `${projectId}/material_layers` },
    ];

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        onTabChange(newValue); // Notify the parent component of the tab change
    };

    return (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
                value={activeTab} // The active tab is managed by the parent
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
            >
                {tabs.map((tab, index) => (
                    <Tab key={index} label={tab.label} />
                ))}
            </Tabs>
        </Box>
    );
}