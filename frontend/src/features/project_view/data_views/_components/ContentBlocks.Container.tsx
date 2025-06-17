import { Box } from '@mui/material';

const ContentBlocksContainer: React.FC<any> = props => {
    return (
        <Box
            className="content-block-container"
            sx={{
                padding: '0px',
                paddingLeft: '6%',
                paddingRight: '6%',
                paddingTop: '35px',
                paddingBottom: '35px',
            }}
        >
            {props.children}
        </Box>
    );
};

export default ContentBlocksContainer;
