import React from 'react';
import { Box, Card, Divider, Grid, Link, Stack, Tooltip, Typography } from '@mui/material';
import {
    titleStyle,
    subTitleStyle,
    ulStyle,
    sideBarStyle,
    sidebarItemStyle,
    sidebarItemSX,
} from './BlowerDoorTest.Style';

const BlowerDoorTestingSidebar: React.FC = () => {
    return (
        <Card sx={sideBarStyle}>
            <Stack sx={{ p: 2 }}>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#preparing">
                    1. Preparing the Building
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
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#requirements">
                    5. Test Requirements
                </Link>
                <Link style={sidebarItemStyle} sx={sidebarItemSX} href="#references">
                    6. Helpful References
                </Link>
            </Stack>
        </Card>
    );
};

const PreparingTheBuilding: React.FC = () => {
    return (
        <Box id="preparing">
            <Typography variant="h4" sx={titleStyle}>
                1. Preparing the Building:
            </Typography>
            <Typography sx={subTitleStyle}>
                Measurements should take place in the &apos;state of use&apos;. This means that during the preparation
                of the building for the test, the only openings which may be sealed are those which would be closed
                tight during normal use.
            </Typography>
            <ul style={ulStyle}>
                <li>All H/ERV ducts connected to the outdoors shall be sealed.</li>
                <li>All plumbing drains should have their P-traps filled with water.</li>
                <li>All exterior doors and windows are to be closed and locked.</li>
                <li>
                    All Interior doors (within the conditioned space) shall be open (closet doors may remain closed).
                </li>
                <li>
                    Dampers of intake/exhaust ducts for combustion air shall be closed - note that these openings may
                    <strong>not</strong> be purposefully sealed for the test.
                </li>
                <li>
                    Ensure that no personnel are moving in or out of the building during the test. Personnel already
                    inside the building may continue working, provided that they do not open or close any doors,
                    windows, or other openings.
                </li>
            </ul>
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
                should be conducted according to either <a href="">EN 13829 (Method A)</a> or alternatively in
                accordance with <Link href="https://www.iso.org/standard/55718.html">ISO 9972 (Method 1)</Link>.
            </Typography>
            <ul style={ulStyle}>
                <li>
                    Configure the blower door fan direction to <strong>pressurize</strong> the building
                </li>
                <li>
                    Starting at 10Pa, measure and record the air leakage rate. Repeat the measurement and record the air
                    leakage rate at a range of pressures from +10Pa up to +60Pa, stepping by 10Pa increments.
                </li>
                <li>
                    Reverse the fan direction to <strong>de-pressurize</strong> the building.
                </li>
                <li>
                    Starting at -10Pa, measure and record the air leakage rate. Repeat the measurement and record the
                    air leakage rate at a range of pressures from -10Pa down to -60Pa, stepping by -10Pa increments.
                </li>
            </ul>
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
                    Seal all identified leaks using appropriate materials like caulk, weatherstripping, or spray foam.
                </li>
                <li>
                    For any project with blowerdoor test results above 0.6ACH50. The team should try to continue to
                    improve the test results. Which means looking for leaks throughout the entire projects. If the test
                    can be brought below 1.0ACH50, but not below 0.6ACH50 then a declaration should be submitted along
                    with the test-report stating that leak tracing was undertaken.
                </li>
            </ul>
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
            <ul style={ulStyle}>
                <li>
                    Building address, Test-date, Architect name, Builder name, Certified Passive House Consultant (CPHC)
                    name
                </li>
                <li>Elevation of building, height of the building</li>
                <li>
                    Standard used (<Link>EN 13829 - method A)</Link>
                </li>
                <li>Which part of the building was tested (floors, areas included, excluded etc.)</li>
                <li>
                    <Tooltip title="iCFA/TFA and Vn50 data to be provided by CPHC.">
                        <span>
                            Net floor area <strong>(iCFA / TFA)</strong> and internal volume of the space{' '}
                            <strong>(Vn50)</strong>
                        </span>
                    </Tooltip>
                </li>
                <li>Documentation of verification of Vn50 calculations.</li>
                <li>Status of all opening in the building enclosure (sealed, open, closed, locked).</li>
                <li>Description of any temporary seals.</li>
                <li>Make and model of blower-door, serial number, date of last calibration.</li>
                <li>Baseline pressure differences.</li>
                <li>Inside and outside temperatures.</li>
                <li>Wind-speed and/or beaufort scale.</li>
                <li>
                    Table of pressure differences and air flow rates (generated by software or derived in manual test)
                </li>
                <li>Air leakage graph</li>
                <li>
                    <Tooltip title="The report should include both the absolute flow rate (m3/hr @ 50Pa) measured and the volumetric air exchange rate (n50) based on Volume provide by the CPHC.">
                        <span style={{ fontStyle: 'italic' }}>
                            Air change rate [n50] at 50Pa for <strong>pressurization, depressurization</strong> and mean
                            value of the two.
                        </span>
                    </Tooltip>
                </li>
                <li style={{ color: 'var( --text-highlight-color)', fontWeight: '700' }}>
                    Note: It is mandatory that the technician who performed the test SIGNS and dates the report before
                    submitting it.
                </li>
            </ul>
        </Box>
    );
};

const TestRequirements: React.FC = () => {
    return (
        <Box id="requirements">
            <Typography variant="h4" sx={titleStyle}>
                5. Test Requirements:
            </Typography>
            <Typography sx={subTitleStyle}>
                The results of the blower door test are only considered valid under the following conditions:
            </Typography>
            <ul style={ulStyle}>
                <li>
                    Wind-speed shall be below 13.4-mph [6 m/s] if measured - otherwise below 3 on the Beaufort scale (ie
                    a gentle breeze).
                </li>
                <li>
                    The result of multiplying the height [ft] of the building * inside/outside delta-T [deg-F] should be
                    below 85.
                </li>
                <li>Baseline pressure should be below 5 Pa over a 30 second average.</li>
                <li>
                    Minimum of <span>5</span> target building pressures are measured.
                </li>
                <li>The maximum building pressure measured must be greater than 50 Pa.</li>
                <li>The interval between the 5 target building pressures must not exceed 10 Pa.</li>
                <li>
                    At least 5 readings per target pressure need to be recorded (most automated systems will exceed this
                    limit).
                </li>
                <li>
                    The lowest pressure point allowed is the larger of: 10Pa or 5x the baseline pressure. ie: if the
                    baseline is 3Pa - the lowest minimum pressure will be 5 x 3Pa = 15Pa.
                </li>
            </ul>
        </Box>
    );
};

const HelpfulReferences: React.FC = () => {
    return (
        <Box id="references">
            <Typography variant="h4" sx={titleStyle}>
                6. Helpful References:
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

const BlowerDoorTesting: React.FC = () => {
    return (
        <>
            <Grid container spacing={2}>
                <Grid size={3}>
                    <BlowerDoorTestingSidebar />
                </Grid>

                <Grid size={9}>
                    <PreparingTheBuilding />

                    <Divider variant="middle" />
                    <RunningTheTest />

                    <Divider variant="middle" />
                    <FindingLeaks />

                    <Divider variant="middle" />
                    <ReportingResults />

                    <Divider variant="middle" />
                    <TestRequirements />

                    <Divider variant="middle" />
                    <HelpfulReferences />
                </Grid>
            </Grid>
        </>
    );
};

export default BlowerDoorTesting;
