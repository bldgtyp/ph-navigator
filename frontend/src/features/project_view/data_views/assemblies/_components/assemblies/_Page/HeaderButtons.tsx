import { Button, Tooltip, IconButton } from '@mui/material';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';

type HeaderButtonId = '+' | '-' | 'refresh' | 'upload' | 'download';

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => Promise<void>;
    loading?: boolean;
}

const hoverText = {
    '+': 'Add a new Assembly.',
    '-': 'Delete the current Assembly.',
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
    handleAddAssembly: () => Promise<void>,
    handleDeleteAssembly: () => Promise<void>,
    handleRefreshMaterials: () => Promise<void>,
    handleUploadConstructions: () => Promise<void>,
    handleDownloadConstructions: () => Promise<void>,
    loading: boolean = false
): React.ReactElement[] {
    return [
        <HeaderTextIconButton
            key={'+'}
            id={'+'}
            text={'+ Add New Assembly'}
            handler={handleAddAssembly}
            loading={loading}
        />,
        <HeaderTextIconButton
            key={'-'}
            id={'-'}
            text={'Delete Assembly'}
            icon={<DeleteForeverRoundedIcon />}
            handler={handleDeleteAssembly}
            loading={loading}
        />,
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
