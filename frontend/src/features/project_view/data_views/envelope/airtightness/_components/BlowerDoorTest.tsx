import '../_styles/pdf-checklist.css';
import { Divider, Grid } from '@mui/material';
import {
    PreparingForTheTest,
    RunningTheTest,
    FindingLeaks,
    ReportingResults,
    HelpfulReferences,
    SealingTable,
} from './BlowerDoorTest.Content';
import BlowerDoorTestingSidebar from './BlowerDoorTest.Sidebar';

const BlowerDoorTesting: React.FC = () => {
    return (
        <>
            <Grid container spacing={2}>
                <Grid size={3}>
                    <BlowerDoorTestingSidebar />
                </Grid>

                <Grid size={9} id="checklist">
                    <PreparingForTheTest />

                    <Divider variant="middle" />
                    <RunningTheTest />

                    <Divider variant="middle" />
                    <FindingLeaks />

                    <Divider variant="middle" />
                    <ReportingResults />

                    <Divider variant="middle" />
                    <HelpfulReferences />

                    <Divider variant="middle" />
                    <SealingTable />
                </Grid>
            </Grid>
        </>
    );
};

export default BlowerDoorTesting;
