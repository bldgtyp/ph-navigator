import React from 'react';
import { Box, Divider, List, ListItem, ListItemText, Typography } from '@mui/material';
import ContentBlockHeader from '../../_components/ContentBlockHeader';

const CONTENT = {
    preparation: {
        title: 'Preparation',
        subtitle:
            'Measurements should take place in the state of use. This means that during the preparation of the building for the test, only those openings should be sealed which would normally be closed tight.',
        items: [
            'Close all exterior doors, windows, and openings.',
            'Open all interior doors to ensure the pressure difference is consistent throughout the building.',
            'Seal any intentional openings, such as vents, chimneys, and flues.',
            'Install the blower door frame and fan in an exterior door, typically the main entrance.',
            'Attach a manometer (pressure gauge) to measure the pressure difference between the inside and outside of the building.',
        ],
    },
    test: {
        title: 'Conducting the Test',
        subtitle:
            'Flow rates are recorded for pressure differences at several points between -70 and +70 Pascals (Pa) of pressure difference. The air-change-rate at +50Pa is interpolated from the range of readings. All tests should be conducted according to either <a href="">EN 13829 (Method A)</a> or alternatively in accordance with <a href="https://www.iso.org/standard/55718.html">ISO 9972 (Method 1)</a>.',
        items: [
            'Turn on the blower door fan to pressurize the building.',
            'Starting at 10Pa, measure and record the air leakage rate. Repeat the measurement and record the air leakage rate at steps of 10PA from +10Pa up to +70Pa.',
            'Reverse the fan direction to DEpressurize the building.',
            'Starting at -10Pa, measure and record the air leakage rate. Repeat the measurement and record the air leakage rate at steps of 10PA from -10Pa up to -70Pa.',
        ],
    },
    leaks: {
        title: 'Identifying and Addressing Leaks',
        items: [
            'Locate areas where air leaks occur, such as around windows, doors, electrical outlets, and penetrations.',
            'Seal identified leaks using appropriate materials like caulk, weatherstripping, or spray foam.',
        ],
    },
    postTest: {
        title: 'Post-Test',
        items: [
            'Retest the building if necessary to confirm that the air leaks have been effectively sealed and that the building meets the desired air-tightness standards.',
        ],
    },
};

const BlowerDoorTestingListGroup: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
    return (
        <>
            <Divider />
            <Typography variant="h5" sx={{ margin: 2 }}>
                {title}:
            </Typography>
            <List component="ol" dense={true}>
                {items.map((item, index) => (
                    <ListItem key={index}>
                        <ListItemText primary={item} />
                    </ListItem>
                ))}
            </List>
        </>
    );
};

const BlowerDoorTesting: React.FC = () => {
    return (
        <>
            {Object.values(CONTENT).map((item, idx) => (
                <BlowerDoorTestingListGroup key={idx} title={item.title} items={item.items} />
            ))}
        </>
    );
};

const AirtightnessPage: React.FC = () => {
    return (
        <>
            <ContentBlockHeader text="Building Airtightness" />

            {/* Building Data for Testing */}
            <Box>
                <Typography variant="h5" sx={{ margin: 2 }}>
                    Building Data:
                </Typography>
                <Box sx={{ margin: 2 }}>Some content</Box>
            </Box>

            {/* Testing Information */}
            <Box sx={{ mt: 6 }}>
                <Typography variant="h5" sx={{ margin: 2 }}>
                    Airtightness Testing:
                </Typography>
                <BlowerDoorTesting />
            </Box>
        </>
    );
};

export default AirtightnessPage;
