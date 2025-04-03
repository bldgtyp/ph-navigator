import { useState } from "react";
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';

type userMenuItemType = {
    displayText: string;
    onClick: () => void;
}


export function UserMenu(params: { username: string }) {
    const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

    const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElUser(event.currentTarget);
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const handleLogout = () => {
        localStorage.removeItem("token"); // Remove the token from localStorage
        setAnchorElUser(null); // Close the menu
        window.location.href = "/login"; // Redirect to the login page
    };

    const handleAccount = () => {
        setAnchorElUser(null); // Close the menu
        window.location.href = "/account"; // Redirect to the account page
    };

    const userMenu: userMenuItemType[] = [
        { displayText: 'Account', onClick: handleAccount }, { displayText: 'Logout', onClick: handleLogout }];


    return (
        <Box sx={{ flexGrow: 0 }}>

            <Tooltip title="Account">
                <Button onClick={handleOpenUserMenu} sx={{ p: 0, fontSize: "0.8rem" }} color="inherit">{params.username}</Button>
            </Tooltip>

            <Menu
                sx={{ mt: '20px' }}
                id="menu-appbar"
                anchorEl={anchorElUser}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
            >
                {userMenu.map((i) => (
                    <MenuItem key={i.displayText} onClick={i.onClick}>
                        <Typography sx={{ textAlign: 'center' }}>{i.displayText}</Typography>
                    </MenuItem>
                ))}
            </Menu>

        </Box>
    )
}