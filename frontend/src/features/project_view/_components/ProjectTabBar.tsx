import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Box from '@mui/material/Box';
import { useNavigate } from 'react-router-dom';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import HomeRepairServiceOutlinedIcon from '@mui/icons-material/HomeRepairServiceOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import DoorSlidingOutlinedIcon from '@mui/icons-material/DoorSlidingOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';

type propsType = {
    projectId: string;
    activeTabNumber: number; // The active tab index managed by the parent
    onTabChange: (newTab: number) => void; // Callback function to notify parent of tab changes
};

const ProjectTabBar: React.FC<propsType> = ({ projectId, activeTabNumber, onTabChange }) => {
    const navigate = useNavigate();

    const tabs = [
        {
            label: 'Certification',
            path: `/project/${projectId}/certification`,
            icon: <WorkspacePremiumOutlinedIcon fontSize="small" />,
        },
        {
            label: 'Windows',
            path: `/project/${projectId}/window-data`,
            icon: <DoorSlidingOutlinedIcon fontSize="small" />,
        },
        {
            label: 'Assemblies',
            path: `/project/${projectId}/assembly-data`,
            icon: <LayersOutlinedIcon fontSize="small" />,
        },
        {
            label: 'Equipment',
            path: `/project/${projectId}/equipment-data`,
            icon: <HomeRepairServiceOutlinedIcon fontSize="small" />,
        },
        {
            label: 'Model',
            path: `/project/${projectId}/model`,
            icon: <ApartmentOutlinedIcon fontSize="small" />,
        },
    ];

    const handleTabChange = (event: React.SyntheticEvent, newTabIndex: number) => {
        // Update parent component state
        onTabChange(newTabIndex);

        // Navigate to the new URL
        navigate(tabs[newTabIndex].path);
    };

    const tabHeight = 40;

    return (
        <Box id="project-tab-bar" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
                value={activeTabNumber}
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
                        icon={tab.icon}
                        iconPosition="start"
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

export default ProjectTabBar;
