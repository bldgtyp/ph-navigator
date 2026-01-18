import { useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useAssemblyContext } from '../Assembly/Assembly.Context';

interface HeaderActionItem {
    id: 'refresh_materials' | 'upload_constructions' | 'download_constructions';
    label: string;
    helperText: string;
    icon: ReactNode;
    handler: () => void | Promise<void>;
    loading?: boolean;
}

const HeaderActionsMenu: React.FC<{ items: HeaderActionItem[] }> = ({ items }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Tooltip title="More actions" placement="top" arrow>
                <IconButton
                    size="small"
                    onClick={handleOpen}
                    aria-label="More actions"
                    aria-controls={isOpen ? 'assembly-header-actions-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={isOpen ? 'true' : undefined}
                >
                    <MoreHorizIcon />
                </IconButton>
            </Tooltip>

            <Menu
                id="assembly-header-actions-menu"
                anchorEl={anchorEl}
                open={isOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {items.map(item => (
                    <MenuItem
                        key={item.id}
                        disabled={item.loading}
                        onClick={() => {
                            handleClose();
                            item.handler();
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                            {item.loading ? <CircularProgress size={16} /> : item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} secondary={item.helperText} />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

export function useAssemblyHeaderButtons(): ReactElement[] {
    const userContext = useContext(UserContext);
    const { handleRefreshMaterials, handleUploadConstructions, handleDownloadConstructions, isRefreshing } =
        useAssemblyContext();

    const menuItems = useMemo<HeaderActionItem[]>(
        () => [
            {
                id: 'refresh_materials',
                label: 'Refresh materials',
                helperText: 'Reload from AirTable',
                icon: <RefreshRoundedIcon fontSize="small" />,
                handler: handleRefreshMaterials,
                loading: isRefreshing,
            },
            {
                id: 'upload_constructions',
                label: 'Upload constructions',
                helperText: 'Import .hbjson or .json file',
                icon: <FileUploadOutlinedIcon fontSize="small" />,
                handler: handleUploadConstructions,
                loading: isRefreshing,
            },
            {
                id: 'download_constructions',
                label: 'Download constructions',
                helperText: 'Export as .json file',
                icon: <FileDownloadOutlinedIcon fontSize="small" />,
                handler: handleDownloadConstructions,
                loading: isRefreshing,
            },
        ],
        [handleRefreshMaterials, handleUploadConstructions, handleDownloadConstructions, isRefreshing]
    );

    // Only show menu for logged-in users
    if (!userContext.user) {
        return [];
    }

    return [<HeaderActionsMenu key="header-actions" items={menuItems} />];
}
