import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useProjectStatusData } from '../_contexts/ProjectDataContext';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ContentBlock from '../../_components/ContentBlock';
import ContentBlockHeader from '../../_components/ContentBlock.Header';
import Markdown from 'markdown-to-jsx';
import DOMPurify from 'dompurify';

const MarkdownCell: React.FC<{ content: string }> = ({ content }) => {
    return (
        <TableCell>
            <Markdown>{DOMPurify.sanitize(content)}</Markdown>
        </TableCell>
    );
};

const ProjectStatusDetailsTable: React.FC<any> = () => {
    const { projectData } = useProjectStatusData();

    return (
        <ContentBlock>
            <ContentBlockHeader text={'Project Status:'} />
            <Table>
                <TableBody>
                    {projectData.steps.map(step => (
                        <TableRow key={step.step_number}>
                            <TableCell>
                                {step.step_number <= projectData.current_step ? (
                                    <CheckCircleRoundedIcon color="primary" />
                                ) : (
                                    <RadioButtonUncheckedRoundedIcon color="disabled" />
                                )}
                            </TableCell>
                            <TableCell>{step.step_number}</TableCell>
                            <TableCell>{step.step_name}</TableCell>
                            <MarkdownCell content={step.notes || ''} />
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ContentBlock>
    );
};

export default ProjectStatusDetailsTable;
