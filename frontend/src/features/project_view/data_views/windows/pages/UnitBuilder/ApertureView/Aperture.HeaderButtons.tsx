import { Button, Tooltip } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useFrameTypes } from '../ElementsTable/FrameType.Context';
import { useGlazingTypes } from '../ElementsTable/GlazingTypes.Context';

type HeaderButtonId = 'refresh_frames' | 'refresh_glazings';

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => Promise<void>;
    loading?: boolean;
}

const hoverText = {
    refresh_frames: 'Reload the frame-types from the AirTable database.',
    refresh_glazings: 'Reload the glazing-types from the AirTable database.',
};

const HeaderTextIconButton: React.FC<HeaderButtonProps> = ({ id, text, icon, handler, loading }) => {
    return (
        <Tooltip title={hoverText[id]} placement="top" arrow>
            <span>
                <Button
                    className="header-button"
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={handler}
                    disabled={loading}
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

    return [
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
