import { Box, Stack } from '@mui/material';

type ContentBlockHeaderProps = {
    text: string;
    buttons?: React.ReactNode[];
};

const ContentBlockHeader: React.FC<ContentBlockHeaderProps> = ({ text, buttons = [] }) => {
    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--appbar-bg-color').trim();
    const headerBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--outline-color').trim();

    return (
        <Stack
            className="content-block-heading"
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
            sx={{
                backgroundColor: headerBgColor,
                borderBottom: `1px solid ${headerBorderColor}`,
                padding: '16px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                textAlign: 'left',
            }}
        >
            {/* Header Text */}
            <h4 style={{ margin: 0 }}>{text}</h4>

            {/* Header Buttons */}
            <Box sx={{ display: 'flex', gap: '8px' }}>
                {buttons.map((button, index) => (
                    <Box key={index}>{button}</Box>
                ))}
            </Box>
        </Stack>
    );
};

export default ContentBlockHeader;
