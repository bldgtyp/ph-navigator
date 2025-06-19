import './_styles/pdf-checklist.css';
import React from 'react';
import {
    Box,
    Card,
    Checkbox,
    Divider,
    Grid,
    Link,
    List,
    ListItem,
    ListItemIcon,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    CheckBoxListStyle,
    CheckBoxLiTextStyle,
    CheckBoxLiStyle,
    titleStyle,
    subTitleStyle,
    ulStyle,
    sideBarStyle,
    sidebarItemStyle,
    sidebarItemSX,
} from './BlowerDoorTest.Styles';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

import TABLE_DATA from './opening_configuration.json';
import { calloutStyle } from './BuildingData.Styles';
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

const CheckBoxLi: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <ListItem sx={CheckBoxLiStyle}>
            <ListItemIcon sx={{ minWidth: 24 }}>
                <CheckBoxOutlineBlankIcon fontSize="small" />
            </ListItemIcon>
            <Typography sx={CheckBoxLiTextStyle}>{children}</Typography>
        </ListItem>
    );
};

const PreparingForTheTest: React.FC = () => {
    return (
        <Box id="preparing">
            <Typography variant="h4" sx={titleStyle}>
                1. Preparing for the Test:
            </Typography>
            <Typography sx={subTitleStyle}>
                Measurements should take place in the &apos;state of use&apos;. This means that during the preparation
                of the building for the test, the only openings which may be sealed are those which would be closed
                tight during normal use.
            </Typography>
            <List sx={CheckBoxListStyle}>
                <CheckBoxLi>All exterior doors and windows are closed and locked.</CheckBoxLi>
                <CheckBoxLi>
                    Ensure that no personnel are moving in or out of the building during the test. Personnel already
                    inside the building may continue working, provided that they do not open or close any doors,
                    windows, or other openings.
                </CheckBoxLi>
                <CheckBoxLi>
                    All Interior doors within the conditioned space are open (closet doors may remain closed).
                </CheckBoxLi>
                <CheckBoxLi>All plumbing drains have their P-traps filled with water.</CheckBoxLi>
                <CheckBoxLi>All H/ERV ducts connected to the outdoors are sealed.</CheckBoxLi>
                <CheckBoxLi>
                    Dampers of intake/exhaust ducts for combustion air are closed (note that these openings may be
                    closed, but may <strong> not</strong> be purposefully sealed).
                </CheckBoxLi>
                <CheckBoxLi>
                    Wind-speed below 13.4-mph [6 m/s] (if measured), otherwise below 3 on the Beaufort scale (ie: a
                    gentle breeze).
                </CheckBoxLi>
                <CheckBoxLi>
                    Building height [ft] x inside-to-outside temperature difference [deg-F] is below
                    <strong> 85.0</strong>
                </CheckBoxLi>
            </List>
        </Box>
    );
};

const RunningTheTest: React.FC = () => {
    return (
        <Box id="running">
            <Typography variant="h4" sx={titleStyle}>
                2. Running the Blower Door Test:
            </Typography>
            <Typography sx={subTitleStyle}>
                Flow rates are recorded for pressure differences at several points between -60 and +60 Pascals (Pa) of
                pressure difference. The air-change-rate at +50Pa is interpolated from the range of readings. All tests
                should be conducted in accordance with{' '}
                <Link href="https://www.iso.org/standard/55718.html">ISO 9972 (Method 1)</Link>.
            </Typography>
            <ul style={ulStyle}>
                <li>
                    Configure the blower door fan direction to <strong>pressurize</strong> the building
                </li>
                <li>Baseline pressure shall be below 5 Pa over a 30 second average.</li>
                <li>
                    Starting pressure to be larger of: 10Pa or 5x the baseline pressure. ie: if the baseline is 3 Pa,
                    the starting pressure will be 5 x 3Pa = 15 Pa.
                </li>
                <li>Measure and record the air leakage rate at the starting pressure.</li>
                <li>
                    Repeat the measurement and record the air leakage rate at a <strong>minimum</strong> of 4 additional
                    pressures, stepping by no more than 10 Pa at each interval.
                </li>
                <li>The highest building pressure measured is at least +50 Pa.</li>
                <li>
                    Reverse the fan direction to <strong>de-pressurize</strong> the building.
                </li>
                <li>Measure and record the air leakage rate at the starting pressure.</li>
                <li>
                    Repeat the measurement and record the air leakage rate at a <strong>minimum</strong> of 4 additional
                    pressures, stepping by no more than -10 Pa at each interval.
                </li>
                <li>The lowest building pressure measured is at least -50 Pa.</li>
            </ul>
            <Typography sx={calloutStyle}>
                <strong>NOTE:</strong> [Criteria for Buildings, Passive House - EnerPHit - PHI Low Energy Building
                Version 10c | 3.2.10.f] &quot; It is required that the measurement equipment is regularly calibrated
                according to the specifications of the manufacturer or standardized quality assurance systems. If too
                much time has already passed since the last calibration, then the result of the measurement may
                <strong> NOT</strong> be used for the certification.&quot;
            </Typography>
        </Box>
    );
};

const FindingLeaks: React.FC = () => {
    return (
        <Box id="identifying">
            <Typography variant="h4" sx={titleStyle}>
                3. Identifying and Addressing Leaks:
            </Typography>
            <Typography sx={subTitleStyle}>
                During the test, the technician and the team should work to identify and mitigate any air leaks.
            </Typography>
            <ul style={ulStyle}>
                <li>
                    Locate areas where air leaks occur, such as around windows, doors, electrical outlets, and
                    penetrations.
                </li>
                <li>
                    Leaks can be identified using smoke pencils, infrared cameras, or by feeling for drafts (use the
                    back of the hand).
                </li>
                <li>
                    Seal all identified leaks using appropriate materials such as tape, caulk, weatherstripping, or
                    spray foam.
                </li>
            </ul>
            <Typography sx={calloutStyle}>
                <strong>NOTE:</strong> [Criteria for Buildings, Passive House - EnerPHit - PHI Low Energy Building
                Version 10c | 3.2.10.f] For any project with blower-door test results above 0.6ACH50. The team should
                try to continue to improve the test results. This means looking for leaks throughout the entire
                projects. If the test can be brought below 1.0ACH50, but not below 0.6ACH50, then a written declaration
                (see below) should be submitted along with the test-report stating that leak tracing was undertaken.
                <br />
                <br />
                Declaration Text: &quot;I hereby confirm that air infiltration leak detection was carried out at
                negative pressure. All rooms within the airtight building envelope were inspected during this process.
                All points known to be prone to leakage were checked for leaks (including locations that were difficult
                to access such as tall ceilings). Any large leakages with a significant share of the total leak ages or
                affecting thermal comfort were sealed.&quot;
            </Typography>
        </Box>
    );
};

const ReportingResults: React.FC = () => {
    return (
        <Box id="reporting">
            <Typography variant="h4" sx={titleStyle}>
                4. Reporting Results:
            </Typography>
            <Typography sx={subTitleStyle}>
                The results of the blower door test must be documented in a report, prepared by the technician that
                includes, at minium:
            </Typography>
            <List sx={CheckBoxListStyle}>
                <CheckBoxLi>
                    Building address, Test-date, Architect name, Builder name, Certified Passive House Consultant (CPHC)
                    name
                </CheckBoxLi>
                <CheckBoxLi>Elevation of building, height of the building</CheckBoxLi>
                <CheckBoxLi>Which part of the building was tested (floors, areas included, excluded etc.)</CheckBoxLi>
                <CheckBoxLi>
                    <Tooltip title="iCFA/TFA and Vn50 data to be provided by CPHC.">
                        <span>
                            Net floor area <strong>(iCFA / TFA)</strong> and internal volume of the space{' '}
                            <strong>(Vn50)</strong>
                        </span>
                    </Tooltip>
                </CheckBoxLi>
                <CheckBoxLi>
                    Photos and description of the blower-door installation location / configuration.
                </CheckBoxLi>
                <CheckBoxLi>Documentation of verification of Vn50 calculations.</CheckBoxLi>
                <CheckBoxLi>Status of all opening in the building enclosure (sealed, open, closed, locked).</CheckBoxLi>
                <CheckBoxLi>Description of any temporary seals.</CheckBoxLi>
                <CheckBoxLi>Make and model of blower-door, serial number, date of last caCheckBoxLibration.</CheckBoxLi>
                <CheckBoxLi>Baseline pressure differences.</CheckBoxLi>
                <CheckBoxLi>Inside and outside temperatures.</CheckBoxLi>
                <CheckBoxLi>Wind-speed and/or beaufort scale.</CheckBoxLi>
                <CheckBoxLi>
                    Table of pressure differences and air flow rates (generated by software or derived in manual test)
                </CheckBoxLi>
                <CheckBoxLi>Air leakage graph</CheckBoxLi>
                <CheckBoxLi>
                    <Tooltip title="The report should include both the absolute flow rate (m3/hr @ 50Pa) measured and the volumetric air exchange rate (n50) based on Volume provide by the CPHC.">
                        <span style={{ fontStyle: 'italic' }}>
                            Air change rate [n50] at 50Pa for <strong>pressurization, depressurization</strong> and mean
                            value of the two.
                        </span>
                    </Tooltip>
                </CheckBoxLi>
            </List>
            <Typography sx={calloutStyle}>
                Note: It is mandatory that the technician who performed the test <strong>SIGNS</strong> and dates the
                report before submitting it.
            </Typography>
        </Box>
    );
};

const HelpfulReferences: React.FC = () => {
    return (
        <Box id="references" className="pdf-no-print">
            <Typography variant="h4" sx={titleStyle}>
                5. Helpful References:
            </Typography>
            <ul style={ulStyle}>
                <li>
                    <Link href="https://475.supply/blogs/design-construction-resources/blowerdoor-protocol-for-verification-of-0-6ach50-for-passive-house-certification?srsltid=AfmBOor0fvgnftXGDSfzUBUN4rQWZGdLXStMBqOEHI5QZzAtUGBSP6r2">
                        475 High Performance: Blower Door Protocol for Passive House Certification
                    </Link>
                </li>
                <li>
                    <Link href="http://www.greenbuild.ie/PassiveHouseBlowerDoorTesting.pdf">
                        Greenbuild.ie | Guidelines for Blower Door Testing of Passive Houses
                    </Link>
                </li>
                <li>
                    <Link href="https://passipedia.org/planning/refurbishment_with_passive_house_components/thermal_envelope/airtightness">
                        Passipedia | Airtightness and airtightness measurement
                    </Link>
                </li>
            </ul>
        </Box>
    );
};

const SealingTable: React.FC = () => {
    return (
        <Box id="openings-table" className="pdf-no-print">
            <Typography variant="h4" sx={titleStyle}>
                6. Allowed Opening Configurations:
            </Typography>
            <Paper elevation={3} sx={{ m: 2 }}>
                <TableContainer sx={{ maxHeight: 440 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Category</TableCell>
                                <TableCell>Item</TableCell>
                                <TableCell>Leave Open</TableCell>
                                <TableCell>Seal</TableCell>
                                <TableCell>Turn Off / Close</TableCell>
                                <TableCell>Comments</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {TABLE_DATA.map(row => (
                                <TableRow key={`${row.category}-${row.item}`}>
                                    <TableCell>{row.category}</TableCell>
                                    <TableCell>{row.item}</TableCell>
                                    <TableCell>
                                        <Checkbox checked={row.leaveOpen === 'X'} />
                                    </TableCell>
                                    <TableCell>
                                        <Checkbox checked={row.seal === 'X'} />
                                    </TableCell>
                                    <TableCell>
                                        <Checkbox checked={row.turnOffOrClose === 'X'} />
                                    </TableCell>
                                    <TableCell>{row.comments}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

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
