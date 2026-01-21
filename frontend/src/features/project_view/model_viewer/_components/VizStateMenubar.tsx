import '../styles/VizStateMenubar.css';
import { useState } from 'react';
import { Stack, Menu, MenuItem, ListItemIcon } from '@mui/material';
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
            </Menu>
        </Stack>
    );
};

export default VizStateMenubar;
