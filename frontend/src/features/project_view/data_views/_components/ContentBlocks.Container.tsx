import { Box } from '@mui/material';
import { contentBlockContainerStyle } from '../_styles/ContentBlocks.Containter.Style';

const ContentBlocksContainer: React.FC<any> = props => {
    return (
        <Box className="content-block-container" sx={contentBlockContainerStyle}>
            {props.children}
        </Box>
    );
};

export default ContentBlocksContainer;
