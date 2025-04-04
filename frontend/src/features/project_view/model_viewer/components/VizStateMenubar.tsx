import '../styles/VizStateMenubar.css';
import { useState } from 'react';
import { Stack } from "@mui/material";
import { ReactComponent as Geometry } from '../icons/Geometry.svg';
import { ReactComponent as FloorSegmentIcon } from '../icons/FloorSegments.svg';
import { ReactComponent as DuctIcon } from '../icons/Ducts.svg';
import { ReactComponent as PipeIcon } from '../icons/Piping.svg';
import { ReactComponent as SpaceIcon } from '../icons/Space.svg';
import { ReactComponent as SunPathIcon } from '../icons/SunPath.svg';
import { useAppVizStateContext } from '../contexts/app_viz_state_context';
import { LightTooltip } from '../styles/styled_components/LightTooltip';

const icons: any[] = [
    <Geometry key={1} title="Exterior Surfaces" />,
    <FloorSegmentIcon key={2} title="Interior Floors" />,
    <SpaceIcon key={3} title="Interior Spaces" />,
    <SunPathIcon key={4} title="Site" />,
    <DuctIcon key={5} title="Ventilation Ducting" />,
    <PipeIcon key={6} title="Hot Water Piping" />,
];

const VizStateMenubar = () => {
    const [activeButton, setActiveButton] = useState<number | null>(null);
    const appStateContext = useAppVizStateContext();

    return (
        <Stack direction="row" spacing={2} className="viz-state-menubar">
            {icons.map((icon, index) => (
                <LightTooltip title={icon.props.title} key={index} placement='top'>
                    <button
                        key={index}
                        className={`viz-state-button ${activeButton === index ? 'active' : ''}`}
                        onClick={() => {
                            // Set the App-State based on the button clicked
                            // Remember: The Toolbar Icon Index starts ay 0, but AppState starts at 1
                            const newAppStateNumber = index + 1
                            if (newAppStateNumber === appStateContext.appVizState.vizState) {
                                appStateContext.dispatch(0)
                                setActiveButton(null);
                            } else {
                                // Set the new State 'On'
                                appStateContext.dispatch(newAppStateNumber)
                                setActiveButton(index);
                            }
                        }}
                    >
                        {icon}
                    </button>
                </LightTooltip>
            ))}
        </Stack>
    );
};

export default VizStateMenubar;