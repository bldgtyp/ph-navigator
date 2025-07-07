import { Button, Tooltip } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

type HeaderButtonId = 'refresh';

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => Promise<void>;
    loading?: boolean;
}

const hoverText = {
    refresh: 'Reload the frames from the AirTable database.',
};

const HeaderTextIconButton: React.FC<HeaderButtonProps> = ({ id, text, icon, handler, loading }) => {
    return (
        <Tooltip title={hoverText[id]} placement="top" arrow>
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
        </Tooltip>
    );
};

export function headerButtons(
    handleRefreshFrames: () => Promise<void>,
    loading: boolean = false
): React.ReactElement[] {
    return [
        <HeaderTextIconButton
            key={'refresh'}
            id={'refresh'}
            text={'Refresh Frames From AirTable'}
            icon={<RefreshRoundedIcon />}
            handler={handleRefreshFrames}
            loading={loading}
        />,
    ];
}
