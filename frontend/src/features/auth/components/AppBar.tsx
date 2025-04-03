import { useContext } from "react";
import { Link } from "react-router-dom";
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { UserContext } from "../../../features/auth/contexts/UserContext";
import { UserMenu } from "./UserMenu";

export default function TopAppBar() {
    const userContext = useContext(UserContext);
    const appBarStyle = { minHeight: "30px !important", height: "30px" }
    const titleStyle = { flexGrow: 1, textDecoration: "none", color: "inherit", fontSize: "0.8rem", alignItems: "center" }

    return (
        <AppBar position="sticky" sx={appBarStyle}>
            <Container maxWidth="xl" sx={appBarStyle}>
                <Toolbar disableGutters sx={appBarStyle}>

                    {userContext.user ? (
                        <>
                            <Typography sx={titleStyle} component={Link} to="/projects">PH-View</Typography>
                            <UserMenu username={userContext.user.username! || ""} />
                        </>
                    ) : (
                        <>
                            <Typography sx={titleStyle}>PH-View</Typography>
                            <Button color="inherit" href="/login" sx={{ fontSize: "0.8rem", alignItems: "center" }}>Login</Button>
                        </>
                    )}

                </Toolbar>
            </Container>
        </AppBar>
    )
}