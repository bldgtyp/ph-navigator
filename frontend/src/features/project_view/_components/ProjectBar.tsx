import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

import { ProjectType } from '../../types/ProjectType';
import { UnitSystemToggle } from './UnitSystemToggle';

type propsType = {
    url: string;
    displayText: string;
};

const ProjectBarLink: React.FC<propsType> = ({ url, displayText }) => {
    return (
        <Button
            color="inherit"
            size="small"
            variant="outlined"
            sx={{ m: '10px' }}
            target="_blank"
            rel="noopener noreferrer"
            href={url}
        >
            {displayText}
        </Button>
    );
};

const ProjectBar: React.FC<ProjectType> = ({ name, phius_dropbox_url, airtable_base_url }) => {
    return (
        <AppBar id="project-bar" position="sticky" sx={{ top: '30px' }}>
            <Toolbar>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>
                    {name}
                </Typography>
                <UnitSystemToggle />
                {phius_dropbox_url ? (
                    <>
                        <ProjectBarLink
                            url="https://www.phius.org/certifications/projects/certification-review-queue"
                            displayText="Phius Queue"
                        />
                        <ProjectBarLink url={phius_dropbox_url} displayText="Phius Dropbox" />
                    </>
                ) : (
                    ''
                )}

                <ProjectBarLink url={airtable_base_url} displayText="AirTable" />
            </Toolbar>
        </AppBar>
    );
};

export default ProjectBar;
