import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ProjectType } from "../../types/Project";


function AppBarLink(props: { url: string, displayText: string }) {
    const { url, displayText } = props;
    return <Button
        color="inherit"
        size="small"
        variant="outlined"
        sx={{ m: "10px", borderRadius: "999px" }}
        target="_blank"
        rel="noopener noreferrer"
        href={url}>
        {displayText}
    </Button>

}

export default function ProjectBar(projectData: ProjectType) {
    return (
        <AppBar id="project-bar" position="sticky" sx={{ backgroundColor: "#68a0e2" }}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1, textDecoration: "none", color: "inherit", }}>
                    {projectData.name}
                </Typography>
                {AppBarLink({ url: "https://www.phius.org/certifications/projects/certification-review-queue", displayText: "Phius Queue" })}
                {AppBarLink({ url: projectData.phius_dropbox_url, displayText: "Phius Dropbox" })}
                {AppBarLink({ url: projectData.airtable_base_url, displayText: "AirTable" })}
            </Toolbar>
        </AppBar>
    )
}