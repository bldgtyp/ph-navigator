import { Stack } from "@mui/material";
import ToolStateMenubar from './ToolStateMenubar';
import VizStateMenubar from './VizStateMenubar';

const BottomMenubar: React.FC = () => {

    return (
        <Stack
            id="model-toolbar"
            position="absolute"
            top="100%"
            left="50%"
            direction="row"
            spacing={1}
            className="bottom-menubar-container"
            sx={{ transform: "translate(-50%, -100%)" }}
            p="15px"
        >
            <ToolStateMenubar />
            <VizStateMenubar />
        </Stack>
    )
}

export default BottomMenubar;