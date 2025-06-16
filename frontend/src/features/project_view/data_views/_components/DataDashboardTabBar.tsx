import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';

type propsType = {
    tabs: { label: string; path: string }[];
    activeTab: number; // The active tab index managed by the parent
    onTabChange: (newTab: number) => void; // Callback function to notify parent of tab changes
};

const DataDashboardTabBar: React.FC<propsType> = ({ tabs, activeTab, onTabChange }) => {
    const navigate = useNavigate();

    const handleTabChange = (event: React.SyntheticEvent, newTabIndex: number) => {
        // Update parent component state
        onTabChange(newTabIndex);

        // Navigate to the new URL
        navigate(tabs[newTabIndex].path);
    };

    const tabHeight = 40;

    return (
        <Box id="tab-bar" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
                value={activeTab} // The active tab is managed by the parent
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
                sx={{
                    minHeight: tabHeight,
                    height: tabHeight,
                }}
            >
                {tabs.map((tab, index) => (
                    <Tab
                        key={index}
                        label={tab.label}
                        sx={{
                            minHeight: tabHeight,
                            height: tabHeight,
                            paddingRight: 2,
                        }}
                    />
                ))}
            </Tabs>
        </Box>
    );
};

export default DataDashboardTabBar;
