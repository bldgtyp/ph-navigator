import '../styles/VizStateMenubar.css';
import { useState } from 'react';
import { Stack, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';
import { ReactComponent as Geometry } from '../icons/Geometry.svg';
import { ReactComponent as FloorSegmentIcon } from '../icons/FloorSegments.svg';
import { ReactComponent as DuctIcon } from '../icons/Ducts.svg';
import { ReactComponent as PipeIcon } from '../icons/Piping.svg';
import { ReactComponent as SpaceIcon } from '../icons/Space.svg';
import { ReactComponent as SunPathIcon } from '../icons/SunPath.svg';
import { ReactComponent as ColorByIcon } from '../icons/ColorBy.svg';
import { useAppVizStateContext } from '../_contexts/app_viz_state_context';
import { useColorByContext, ColorByAttribute } from '../_contexts/color_by_context';
import { appVizStateTypeEnum } from '../states/VizState';
import { LightTooltip } from '../styles/styled_components/LightTooltip';

// Sub-menu icon components for color-by options
const FaceTypeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="2" y="2" width="16" height="16" fill="#E6B43C" stroke="#333" strokeWidth="1" />
    </svg>
);

const BoundaryIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="8" fill="#40B4FF" stroke="#333" strokeWidth="1" />
    </svg>
);

const OpaqueConstructionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        {/* Stacked layers icon representing wall assembly */}
        <rect x="3" y="3" width="14" height="4" fill="#808080" stroke="#333" strokeWidth="0.5" />
        <rect x="3" y="8" width="14" height="4" fill="#A0A0A0" stroke="#333" strokeWidth="0.5" />
        <rect x="3" y="13" width="14" height="4" fill="#C0C0C0" stroke="#333" strokeWidth="0.5" />
    </svg>
);

const ApertureConstructionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        {/* Window pane icon representing glazing */}
        <rect x="3" y="3" width="14" height="14" fill="none" stroke="#333" strokeWidth="1.5" />
        <line x1="10" y1="3" x2="10" y2="17" stroke="#333" strokeWidth="1" />
        <line x1="3" y1="10" x2="17" y2="10" stroke="#333" strokeWidth="1" />
        <rect x="4" y="4" width="5" height="5" fill="#4AB4FF" fillOpacity="0.5" />
        <rect x="11" y="4" width="5" height="5" fill="#4AB4FF" fillOpacity="0.5" />
        <rect x="4" y="11" width="5" height="5" fill="#4AB4FF" fillOpacity="0.5" />
        <rect x="11" y="11" width="5" height="5" fill="#4AB4FF" fillOpacity="0.5" />
    </svg>
);

const VentilationAirflowIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        {/* Airflow arrows representing ventilation - supply (blue) and extract (red) */}
        <path
            d="M4 10 L10 10 L8 7 M10 10 L8 13"
            fill="none"
            stroke="#8CCEFE"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M16 10 L10 10 L12 7 M10 10 L12 13"
            fill="none"
            stroke="#FE8C8C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

const FloorWeightingFactorIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20">
        {/* Floor grid with varying colors representing weighting factors */}
        <rect x="2" y="2" width="7" height="7" fill="#F5E470" stroke="#666" strokeWidth="0.5" />
        <rect x="11" y="2" width="7" height="7" fill="#B9E98A" stroke="#666" strokeWidth="0.5" />
        <rect x="2" y="11" width="7" height="7" fill="#88E2EF" stroke="#666" strokeWidth="0.5" />
        <rect x="11" y="11" width="7" height="7" fill="#EE00FF" stroke="#666" strokeWidth="0.5" />
    </svg>
);

const icons: any[] = [
    <Geometry key={1} title="Exterior Surfaces" />,
    <FloorSegmentIcon key={2} title="Interior Floors" />,
    <SpaceIcon key={3} title="Interior Spaces" />,
    <SunPathIcon key={4} title="Site" />,
    <DuctIcon key={5} title="Ventilation Ducting" />,
    <PipeIcon key={6} title="Hot Water Piping" />,
    <ColorByIcon key={7} title="Color By..." />,
];

const GEOMETRY_BUTTON_INDEX = 0; // Geometry is the 1st button (index 0)
const COLOR_BY_BUTTON_INDEX = 6; // ColorBy is the 7th button (index 6)

const VizStateMenubar: React.FC = () => {
    const [activeButton, setActiveButton] = useState<number>(0);
    const [colorByAnchor, setColorByAnchor] = useState<HTMLElement | null>(null);
    const appStateContext = useAppVizStateContext();
    const colorByContext = useColorByContext();

    const handleColorBySelect = (attribute: ColorByAttribute) => {
        colorByContext.setColorByAttribute(attribute);
        setColorByAnchor(null);

        // Only switch to ColorBy mode if not already in it
        // If already in ColorBy mode, the useEffect in World.tsx will re-apply colors
        if (appStateContext.appVizState.vizState !== appVizStateTypeEnum.ColorBy) {
            appStateContext.dispatch(appVizStateTypeEnum.ColorBy);
            setActiveButton(COLOR_BY_BUTTON_INDEX);
        }
    };

    const handleButtonClick = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
        // ColorBy button opens sub-menu instead of directly setting state
        if (index === COLOR_BY_BUTTON_INDEX) {
            setColorByAnchor(event.currentTarget);
            return;
        }

        // Set the App-State based on the button clicked
        // Remember: The Toolbar Icon Index starts at 0, but AppState starts at 1
        const newAppStateNumber = index + 1;
        if (newAppStateNumber === appStateContext.appVizState.vizState) {
            // Already in this state - default back to Geometry
            appStateContext.dispatch(appVizStateTypeEnum.Geometry);
            setActiveButton(GEOMETRY_BUTTON_INDEX);
        } else {
            // Set the new State 'On'
            appStateContext.dispatch(newAppStateNumber);
            setActiveButton(index);
        }
    };

    return (
        <Stack id="viz-state-menubar" direction="row" spacing={2} className="viz-state-menubar">
            {icons.map((icon, index) => (
                <LightTooltip title={icon.props.title} key={index} placement="top">
                    <button
                        key={index}
                        className={`viz-state-button ${activeButton === index ? 'active' : ''}`}
                        onClick={e => handleButtonClick(index, e)}
                    >
                        {icon}
                    </button>
                </LightTooltip>
            ))}
            <Menu
                anchorEl={colorByAnchor}
                open={Boolean(colorByAnchor)}
                onClose={() => setColorByAnchor(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.FaceType)}>
                    <ListItemIcon>
                        <FaceTypeIcon />
                    </ListItemIcon>
                    Face Type
                </MenuItem>
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.Boundary)}>
                    <ListItemIcon>
                        <BoundaryIcon />
                    </ListItemIcon>
                    Boundary
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.OpaqueConstruction)}>
                    <ListItemIcon>
                        <OpaqueConstructionIcon />
                    </ListItemIcon>
                    Opaque Constr.
                </MenuItem>
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.ApertureConstruction)}>
                    <ListItemIcon>
                        <ApertureConstructionIcon />
                    </ListItemIcon>
                    Aperture Constr.
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.VentilationAirflow)}>
                    <ListItemIcon>
                        <VentilationAirflowIcon />
                    </ListItemIcon>
                    Ventilation Airflow
                </MenuItem>
                <MenuItem onClick={() => handleColorBySelect(ColorByAttribute.FloorWeightingFactor)}>
                    <ListItemIcon>
                        <FloorWeightingFactorIcon />
                    </ListItemIcon>
                    Floor Weighting Factor
                </MenuItem>
            </Menu>
        </Stack>
    );
};

export default VizStateMenubar;
