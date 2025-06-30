import { Box } from '@mui/material';
import { contentBlockStyle } from '../_styles/ContentBlock.Style';

const ContentBlock: React.FC<any> = props => {
    return (
        <Box className="content-block" sx={contentBlockStyle}>
            {props.children}
        </Box>
    );
};

export default ContentBlock;
