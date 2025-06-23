import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { UserContext } from '../../../features/auth/_contexts/UserContext';
import UserMenu from './UserMenu';

const titleStyle = { flexGrow: 1, textDecoration: 'none', color: 'inherit', fontSize: '0.8rem', alignItems: 'center' };
const appBarStyle = { minHeight: '30px !important', height: '30px', margin: 0 };

const Title: React.FC = () => {
    const userContext = useContext(UserContext);

    return userContext.user ? (
        <Typography sx={titleStyle} component={Link} to="/projects">
            PH-Navigator
        </Typography>
    ) : (
        <Typography sx={titleStyle}>PH-Navigator</Typography>
    );
};

const Login: React.FC = () => {
    const userContext = useContext(UserContext);
    return userContext.user ? (
        <UserMenu username={userContext.user.username} />
    ) : (
        <Button color="inherit" href="/login" sx={{ fontSize: '0.8rem', alignItems: 'center' }}>
            Login
        </Button>
    );
};

const TopAppBar: React.FC = () => {
    return (
        <AppBar id="app-bar" position="sticky" sx={appBarStyle}>
            <Toolbar sx={appBarStyle}>
                <Title />
                <Login />
            </Toolbar>
        </AppBar>
    );
};

export default TopAppBar;
