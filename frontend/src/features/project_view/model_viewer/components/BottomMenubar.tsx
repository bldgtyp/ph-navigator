import "../styles/BottomMenubar.css";
import { Stack } from "@mui/material";
import ToolStateMenubar from './ToolStateMenubar';
import VizStateMenubar from './VizStateMenubar';

function BottomMenubar() {

    return (
        <Stack direction="row" spacing={1} className="bottom-menubar-container">
            <ToolStateMenubar />
            <VizStateMenubar />
        </Stack>
    )
}

export default BottomMenubar;