import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Box from "@mui/material/Box";

type propsType = {
    projectId: string;
    activeTab: number; // The active tab index managed by the parent
    onTabChange: (newTab: number) => void; // Callback function to notify parent of tab changes
}

const EquipmentDataDashboardTabBar: React.FC<propsType> = ({ projectId, activeTab, onTabChange }) => {
    const tabs = [
        { label: "Pumps", path: `${projectId}/pumps` },
        { label: "Tanks", path: `${projectId}/dhw_tanks` },
        { label: "Fans", path: `${projectId}/fans` },
        { label: "Lighting", path: `${projectId}/lighting` },
        { label: "Appliances", path: `${projectId}/appliances` },
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

export default EquipmentDataDashboardTabBar;