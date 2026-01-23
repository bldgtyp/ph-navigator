import { CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import TuneIcon from '@mui/icons-material/Tune';
import { useFrameTypes } from '../../../_contexts/FrameType.Context';
import { useGlazingTypes } from '../../../_contexts/GlazingTypes.Context';
import { useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { ManufacturerFilterModal } from '../ManufacturerFilterModal/Modal.ManufacturerFilter';

interface HeaderActionItem {
    id: 'refresh_frames' | 'refresh_glazings' | 'configure_filters';
    label: string;
    helperText: string;
    icon: ReactNode;
    handler: () => void | Promise<void>;
    loading?: boolean;
}

interface HeaderActionsMenuProps {
    items: HeaderActionItem[];
    isAnyLoading: boolean;
}

const HeaderActionsMenu: React.FC<HeaderActionsMenuProps> = ({ items, isAnyLoading }) => {
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
            <Tooltip title={isAnyLoading ? 'Loading...' : 'More actions'} placement="top" arrow>
                <span>
                    <IconButton
                        size="small"
                        onClick={handleOpen}
                        disabled={isAnyLoading}
                        aria-label="More actions"
                        aria-controls={isOpen ? 'aperture-header-actions-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={isOpen ? 'true' : undefined}
                    >
                        {isAnyLoading ? <CircularProgress size={20} /> : <MoreHorizIcon />}
                    </IconButton>
                </span>
            </Tooltip>

            <Menu
                id="aperture-header-actions-menu"
                anchorEl={anchorEl}
                open={isOpen}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {items.map(item => (
                    <MenuItem
                        key={item.id}
                        disabled={isAnyLoading}
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

export function useHeaderButtons(): ReactElement[] {
    const userContext = useContext(UserContext);
    const { isLoadingFrameTypes, handleRefreshFrameTypes } = useFrameTypes();
    const { isLoadingGlazingTypes, handleRefreshGlazingTypes } = useGlazingTypes();
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    const menuItems = useMemo<HeaderActionItem[]>(
        () => [
            {
                id: 'configure_filters',
                label: 'Configure manufacturer filters',
                helperText: 'Select visible manufacturers',
                icon: <TuneIcon fontSize="small" />,
                handler: () => setIsFilterModalOpen(true),
            },
            {
                id: 'refresh_frames',
                label: 'Refresh frame types',
                helperText: 'Reload from AirTable',
                icon: <RefreshRoundedIcon fontSize="small" />,
                handler: handleRefreshFrameTypes,
                loading: isLoadingFrameTypes,
            },
            {
                id: 'refresh_glazings',
                label: 'Refresh glazing types',
                helperText: 'Reload from AirTable',
                icon: <RefreshRoundedIcon fontSize="small" />,
                handler: handleRefreshGlazingTypes,
                loading: isLoadingGlazingTypes,
            },
        ],
        [handleRefreshFrameTypes, handleRefreshGlazingTypes, isLoadingFrameTypes, isLoadingGlazingTypes]
    );

    const isAnyLoading = isLoadingFrameTypes || isLoadingGlazingTypes;

    if (!userContext.user) {
        return [];
    }

    return [
        <HeaderActionsMenu key="header-actions" items={menuItems} isAnyLoading={isAnyLoading} />,
        <ManufacturerFilterModal
            key="filter-modal"
            open={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
        />,
    ];
}
