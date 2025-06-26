import { Button, Tooltip, IconButton } from '@mui/material';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

type HeaderButtonId = 'refresh' | 'upload' | 'download';

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => Promise<void>;
    loading?: boolean;
}

const hoverText = {
    refresh: 'Reload the materials from the AirTable database.',
    upload: 'Upload an HBJSON file containing one or more HB-Constructions. These will be added to the set of assemblies and will OVERWRITE any existing Assemblies with the same name.',
    download: 'Download an HBJSON file all of the HB-Constructions or the project.',
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

const HeaderIconButton: React.FC<HeaderButtonProps> = ({ id, text, icon, handler, loading }) => {
    return (
        <Tooltip title={hoverText[id]} placement="top" arrow>
            <IconButton
                className="header-button"
                id={id}
                color="inherit"
                size="small"
                onClick={handler}
                disabled={loading}
                sx={{
                    height: '30px',
                    width: '30px',
                }}
            >
                {loading ? '...' : icon}
            </IconButton>
        </Tooltip>
    );
};

export function headerButtons(
    handleRefreshMaterials: () => Promise<void>,
    handleUploadConstructions: () => Promise<void>,
    handleDownloadConstructions: () => Promise<void>,
    loading: boolean = false
): React.ReactElement[] {
    return [
        <HeaderTextIconButton
            key={'refresh'}
            id={'refresh'}
            text={'Refresh Materials'}
            icon={<RefreshRoundedIcon />}
            handler={handleRefreshMaterials}
            loading={loading}
        />,
        <HeaderIconButton
            key={'upload'}
            id={'upload'}
            text={''}
            icon={<FileUploadOutlinedIcon />}
            handler={handleUploadConstructions}
            loading={loading}
        />,
        <HeaderIconButton
            key={'download'}
            id={'download'}
            text={''}
            icon={<FileDownloadOutlinedIcon />}
            handler={handleDownloadConstructions}
            loading={loading}
        />,
    ];
}
