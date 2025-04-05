import { Link } from "react-router-dom";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { ProjectType } from "../../types/ProjectType";

const ProjectCard: React.FC<ProjectType> = ({ bt_number, name, phius_number, airtable_base_url }) => {
    return (
        <Card elevation={5} sx={{ minWidth: 300, maxWidth: 450, margin: "10px", backgroundColor: "#f5f5f5" }}>
            <CardActionArea component={Link} to={`/project/${bt_number}`}>
                <CardContent >
                    <Typography gutterBottom variant="h5" component="div">
                        Project: {name}
                    </Typography>
                    <Divider></Divider>
                    <Stack spacing={1} sx={{ m: 2 }}>
                        <Typography variant="body2">BLDGtyp Number: {bt_number}</Typography>
                        <Typography variant="body2">PHIUS Number: {phius_number}</Typography>
                    </Stack>
                </CardContent>
            </CardActionArea>
            <CardContent>
                <Button variant="outlined" target="_blank" rel="noopener noreferrer" href={airtable_base_url}>AirTable Database</Button>
            </CardContent>
        </Card>
    );
}

export default ProjectCard;