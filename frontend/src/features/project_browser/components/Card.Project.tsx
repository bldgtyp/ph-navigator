import { Link, useNavigate } from "react-router-dom";
import Button from "@mui/material/Button";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { ProjectType } from "../../types/ProjectType";
import CardContainer from "./Card.Container";
import { Box } from "@mui/material";

const ProjectCard: React.FC<ProjectType> = ({ bt_number, name, phius_number, airtable_base_url }) => {
    const navigate = useNavigate();

    const handleSettingsClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the click from triggering the parent `CardActionArea` navigation
        navigate(`/project/${bt_number}/settings`);
    };

    return (
        <CardContainer>
            <CardActionArea component={Link} to={`/project/${bt_number}`}>
                <CardContent >

                    <Typography variant="h5" component="div">
                        {bt_number}: {name}
                    </Typography>

                    <Divider />

                    <Stack spacing={1} sx={{ m: 2 }}>
                        <Typography variant="body2">BLDGtyp Number: {bt_number}</Typography>
                        <Typography variant="body2">PHIUS Number: {phius_number}</Typography>
                    </Stack>

                </CardContent>
            </CardActionArea>

            <CardContent>
                <Divider />
                <Box sx={{ marginTop: "25px", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={airtable_base_url}
                    >
                        AirTable
                    </Button>
                    <Button
                        onClick={handleSettingsClick}
                        sx={{ color: "text.secondary" }}
                        aria-label="settings"
                        variant="outlined"
                        endIcon={<SettingsOutlinedIcon fontSize="medium" />}
                    >
                        Config
                    </Button>
                </Box>
            </CardContent>
        </CardContainer>
    );
}

export default ProjectCard;