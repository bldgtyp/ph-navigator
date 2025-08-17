import { Box, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import { contentBlockStyle } from '../_styles/ContentBlock.Style';
import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';

export interface RequiredSitePhotoProps {
    number: number;
    captions: string[];
    src: string;
}

const RequiredSitePhoto: React.FC<RequiredSitePhotoProps> = ({ number, captions, src }) => {
    // Safely read CSS var only in browser (avoids SSR / hydration mismatches) and provide fallback
    const headerBgColor =
        typeof window !== 'undefined'
            ? getComputedStyle(document.documentElement).getPropertyValue('--appbar-bg-color').trim()
            : '#f5f5f5';

    return (
        <Box
            className="image-with-caption-outer"
            sx={{
                height: '100%',
                backgroundColor: headerBgColor,
                ...contentBlockStyle,
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Stack
                className="image-with-caption-inner"
                direction="column"
                alignItems="left"
                spacing={2}
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    p: 3,
                }}
            >
                {/* Typography previously rendered a <p> which cannot legally contain a <ul>; use div component */}
                <Typography variant="body1" component="div" sx={{ lineHeight: 1.3 }}>
                    <List dense sx={{ m: 0, p: 0 }}>
                        {captions.map(cap => (
                            <ListItem key={cap} sx={{ py: 0, alignItems: 'flex-start' }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <AddAPhotoOutlinedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={cap} />
                            </ListItem>
                        ))}
                    </List>
                </Typography>

                {/* Spacer */}
                <Box sx={{ flexGrow: 1 }} />

                {/* Move padding here to properly space the image from bottom */}
                <Box
                    sx={{
                        border: '1px solid #ddd',
                        boxShadow: 1,
                    }}
                    className="image-container"
                >
                    <img src={src} style={{ width: '100%', display: 'block' }} alt={`Site photo ${number}`} />
                </Box>
            </Stack>
        </Box>
    );
};

export default RequiredSitePhoto;
