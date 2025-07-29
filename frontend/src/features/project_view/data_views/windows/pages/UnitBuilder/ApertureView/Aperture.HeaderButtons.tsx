import { Button, Tooltip } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import { useFrameTypes } from '../ElementsTable/FrameType.Context';
import { useGlazingTypes } from '../ElementsTable/GlazingTypes.Context';
import { useZoom } from './Zoom.Context';

type HeaderButtonId = 'refresh_frames' | 'refresh_glazings' | 'zoom_in' | 'zoom_out';

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
}

const hoverText = {
    refresh_frames: 'Reload the frame-types from the AirTable database.',
    refresh_glazings: 'Reload the glazing-types from the AirTable database.',
    zoom_in: 'Zoom in to see more detail.',
    zoom_out: 'Zoom out to see more of the aperture.',
};

const HeaderTextIconButton: React.FC<HeaderButtonProps> = ({ id, text, icon, handler, loading, disabled }) => {
    return (
        <Tooltip title={hoverText[id]} placement="top" arrow>
            <span>
                <Button
                    className="header-button"
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={handler}
                    disabled={loading || disabled}
                    startIcon={icon}
                >
                    {loading ? 'Loading....' : text}
                </Button>
            </span>
        </Tooltip>
    );
};

export function useHeaderButtons(): React.ReactElement[] {
    const { isLoadingFrameTypes, handleRefreshFrameTypes } = useFrameTypes();
    const { isLoadingGlazingTypes, handleRefreshGlazingTypes } = useGlazingTypes();
    const { zoomIn, zoomOut, scaleFactor, getScaleLabel } = useZoom();

    // Calculate if zoom buttons should be disabled based on scale limits
    const isZoomInDisabled = scaleFactor >= 5.0;
    const isZoomOutDisabled = scaleFactor <= 0.1;

    return [
        <HeaderTextIconButton
            key={'zoom_out'}
            id={'zoom_out'}
            text={`Zoom Out`}
            icon={<ZoomOutIcon />}
            handler={zoomOut}
            disabled={isZoomOutDisabled}
        />,
        <HeaderTextIconButton
            key={'zoom_in'}
            id={'zoom_in'}
            text={`Zoom In (${getScaleLabel()})`}
            icon={<ZoomInIcon />}
            handler={zoomIn}
            disabled={isZoomInDisabled}
        />,
        <HeaderTextIconButton
            key={'refresh_frames'}
            id={'refresh_frames'}
            text={'Refresh Frame-Types From AirTable'}
            icon={<RefreshRoundedIcon />}
            handler={handleRefreshFrameTypes}
            loading={isLoadingFrameTypes}
        />,
        <HeaderTextIconButton
            key={'refresh_glazings'}
            id={'refresh_glazings'}
            text={'Refresh Glazing-Types From AirTable'}
            icon={<RefreshRoundedIcon />}
            handler={handleRefreshGlazingTypes}
            loading={isLoadingGlazingTypes}
        />,
    ];
}
