import { Box } from '@mui/material';

const ContentBlock: React.FC<any> = props => {
    return (
        <Box
            className="content-block"
            sx={{
                outline: '1px solid #E0E0E0',
                borderRadius: '8px',
                paddingBottom: '10px',
                marginBottom: '20px',
                // overflow: 'hidden',
            }}
        >
            {props.children}
        </Box>
    );
};

export default ContentBlock;
