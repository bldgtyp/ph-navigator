import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { UserContext } from "../_contexts/UserContext";
import { UserContextType } from "../../types/UserType";
import constants from "../../../data/constants.json";

const Login: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const userContext = useContext(UserContext) as UserContextType;

    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const API_BASE_URL = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const response = await fetch(`${API_BASE_URL}auth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });

        if (response.ok) {
            const data = await response.json();
            userContext.login(data.access_token);
            navigate("/projects");
        } else {
            alert("Invalid credentials");
        }
    };

    return (
        <Box id="login-container"
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100vh",
                backgroundColor: "#f5f5f5",
            }}
        >
            <Card id="login-card" sx={{ width: 400, padding: 4, boxShadow: 3 }}>
                <Typography variant="h5" component="h1" gutterBottom align="center">
                    Login
                </Typography>
                <Box
                    id="login-form"
                    component="form"
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                    noValidate
                    autoComplete="off"
                    onSubmit={handleLogin}
                >
                    <TextField
                        required
                        id="username"
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        required
                        id="password"
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        fullWidth
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        sx={{ mt: 2 }}
                        fullWidth
                    >
                        Login
                    </Button>
                </Box>
            </Card>
        </Box>
    );
};

export default Login;