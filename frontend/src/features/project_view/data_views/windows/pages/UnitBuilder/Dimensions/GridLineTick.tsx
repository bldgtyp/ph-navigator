import { Box } from '@mui/material';

const GridLineTick: React.FC<{
    orientation: 'horizontal' | 'vertical';
    location: number;
}> = ({ orientation, location }) => {
    const tickLength = 30;

    return (
        <Box
            sx={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '20px',
                top: orientation === 'vertical' ? `${location}px` : '0px',
                left: orientation === 'vertical' ? 'auto' : `${location}px`,
                right: orientation === 'vertical' ? 0 : 'auto',
                transform: orientation === 'vertical' ? 'translateY(0%)' : 'translateX(-50%)',
            }}
        >
            <Box
                sx={{
                    width: orientation === 'vertical' ? tickLength : '1px',
                    height: orientation === 'vertical' ? '1px' : tickLength,
                    bgcolor: 'grey.500',
                }}
            />
        </Box>
    );
};

export default GridLineTick;
