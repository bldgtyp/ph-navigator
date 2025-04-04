import "../styles/ToolStateMenubar.css";
import { useState } from 'react';
import { Paper } from "@mui/material";
import { ReactComponent as RulerIcon } from '../icons/Ruler.svg';
import { ReactComponent as SurfaceIcon } from '../icons/Surface.svg';
import { ReactComponent as NoteIcon } from '../icons/Note.svg';
import { useAppToolStateContext } from '../contexts/app_tool_state_context';
import { LightTooltip } from '../styles/styled_components/LightTooltip';

const icons: any[] = [
    <SurfaceIcon key={0} title="Select Object" />,
    <RulerIcon key={1} title="Measure" />,
    <NoteIcon key={2} title="Comments" />,
];


function ToolStateMenubar() {
    const [activeButton, setActiveButton] = useState<number | null>(null);
    const appStateContext = useAppToolStateContext();

    return (
        <Paper className="tool-state-menubar" >
            {icons.map((icon, index) => (
                <LightTooltip title={icon.props.title} key={index}>
                    <button
                        key={index}
                        className={`tool-state-button ${activeButton === index ? 'active' : ''}`}
                        onClick={() => {
                            // Set the App-State based on the button clicked
                            // Remember: The Toolbar Icon Index starts ay 0, but AppState starts at 1
                            const newAppStateNumber = index + 1;
                            if (newAppStateNumber === appStateContext.appToolState.toolState) {
                                appStateContext.dispatch(0);
                                setActiveButton(null);
                            } else {
                                // Set the new State 'On'
                                appStateContext.dispatch(newAppStateNumber);
                                setActiveButton(index);
                            }
                        }}
                    >
                        {icon}
                    </button>
                </LightTooltip>
            ))}
        </Paper>
    );
}

export default ToolStateMenubar;