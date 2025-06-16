import { useContext } from 'react';
import { Link } from 'react-router-dom';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { UserContext } from '../../../features/auth/_contexts/UserContext';
import UserMenu from './UserMenu';

const titleStyle = { flexGrow: 1, textDecoration: 'none', color: 'inherit', fontSize: '0.8rem', alignItems: 'center' };
const appBarStyle = { minHeight: '30px !important', height: '30px' };

const UserLoggedIn: React.FC<{ username: string }> = ({ username }) => {
    return (
        <>
            <Typography sx={titleStyle} component={Link} to="/projects">
                PH-View
            </Typography>
            <UserMenu username={username} />
        </>
    );
};

const UserNotLoggedIn: React.FC = () => {
    return (
        <>
            <Typography sx={titleStyle}>PH-View</Typography>
            <Button color="inherit" href="/login" sx={{ fontSize: '0.8rem', alignItems: 'center' }}>
                Login
            </Button>
        </>
    );
};

const TopAppBar: React.FC = () => {
    const userContext = useContext(UserContext);

    return (
        <AppBar id="app-bar" position="sticky" sx={appBarStyle}>
            <Container maxWidth="xl" sx={appBarStyle}>
                <Toolbar disableGutters sx={appBarStyle}>
                    {userContext.user ? <UserLoggedIn username={userContext.user.username} /> : <UserNotLoggedIn />}
                </Toolbar>
            </Container>
        </AppBar>
    );
};

export default TopAppBar;
