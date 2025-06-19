import { Card, Link, Stack } from '@mui/material';
import { sideBarStyle, sidebarItemStyle, sidebarItemSX } from './BlowerDoorTest.Styles';
import DownloadPdfButton from './BlowerDoorTest.DownloadBtn';

const BlowerDoorTestingSidebar: React.FC = () => {
    return (
        <Card sx={sideBarStyle}>
            <Stack sx={{ p: 2 }}>
                <DownloadPdfButton targetElementId="checklist" filename="project-checklist.pdf" />
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#preparing">
                    1. Preparing for the Test
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#running">
                    2. Running the Blower Door Test
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#identifying">
                    3. Identifying and Addressing Leaks
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#reporting">
                    4. Reporting Results
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#references">
                    5. Helpful References
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#openings-table">
                    6. Allowed Opening Configurations:
                </Link>
            </Stack>
        </Card>
    );
};

export default BlowerDoorTestingSidebar;
