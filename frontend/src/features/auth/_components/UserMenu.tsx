import { useState } from 'react';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';

type userMenuItemType = {
    displayText: string;
    onClick: () => void;
};

const UserMenuItems: React.FC<{ userMenuItems: userMenuItemType[] }> = ({ userMenuItems }) => {
    return (
        <>
            {userMenuItems.map(i => (
                <MenuItem key={i.displayText} onClick={i.onClick}>
                    <Typography sx={{ textAlign: 'center' }}>{i.displayText}</Typography>
                </MenuItem>
            ))}
        </>
    );
};

const UserMenu: React.FC<{ username: string }> = ({ username }) => {
    const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        setAnchorElUser(null);
        window.location.href = '/login';
    };

    const handleAccount = () => {
        setAnchorElUser(null);
        window.location.href = '/account';
    };

    const userMenuItems: userMenuItemType[] = [
        { displayText: 'Account', onClick: handleAccount },
        { displayText: 'Logout', onClick: handleLogout },
    ];

    return (
        <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Account">
                <Button
                    onClick={e => setAnchorElUser(e.currentTarget)}
                    sx={{ p: 0, fontSize: '0.8rem' }}
                    color="inherit"
                >
                    {username}
                </Button>
            </Tooltip>

            <Menu
                sx={{ mt: '20px' }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorElUser)}
                onClose={() => setAnchorElUser(null)}
            >
                <UserMenuItems userMenuItems={userMenuItems} />
            </Menu>
        </Box>
    );
};

export default UserMenu;
