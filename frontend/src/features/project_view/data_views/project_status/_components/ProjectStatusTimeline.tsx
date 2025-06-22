import { Grid, Stack } from '@mui/material';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { useProjectStatusData } from '../_contexts/ProjectDataContext';
import { timelineStyleSx } from './ProjectStatusTimeline.Styles';
import Markdown from 'markdown-to-jsx';
import DOMPurify from 'dompurify';

const StepWithNotes: React.FC<{ label: string; notes: string }> = ({ label, notes }) => {
    return (
        <StepLabel>
            <Grid container>
                <Grid
                    size={4}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.05rem',
                        fontWeight: 'bold',
                        p: 1,
                        borderRight: '1px solid #ccc',
                    }}
                >
                    {label}
                </Grid>
                <Grid
                    size={8}
                    sx={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', fontStyle: 'italic', p: 1 }}
                >
                    <Markdown>{DOMPurify.sanitize(notes)}</Markdown>
                </Grid>
            </Grid>
        </StepLabel>
    );
};

const ProjectStatusTimeline: React.FC = () => {
    const { projectData } = useProjectStatusData();

    return (
        <Stack spacing={4} sx={{ m: 2, mb: 8, mt: 6, maxWidth: '1000px' }}>
            <Stepper orientation="vertical" activeStep={projectData.current_step} sx={timelineStyleSx}>
                {projectData.steps.map((s: any) => {
                    return (
                        <Step key={s.step_number} expanded={true}>
                            <StepWithNotes label={s.step_name} notes={s.notes}></StepWithNotes>
                        </Step>
                    );
                })}
            </Stepper>
        </Stack>
    );
};

export default ProjectStatusTimeline;
