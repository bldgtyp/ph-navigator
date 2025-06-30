import { Box, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import { contentBlockStyle } from '../_styles/ContentBlock.Style';
import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';

export interface RequiredSitePhotoProps {
    number: number;
    captions: string[];
    src: string;
}

const RequiredSitePhoto: React.FC<RequiredSitePhotoProps> = ({ number, captions, src }) => {
    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--appbar-bg-color').trim();

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
                <Typography variant="body1">
                    <List dense>
                        {captions.map(cap => (
                            <ListItem key={cap}>
                                <ListItemIcon>
                                    <AddAPhotoOutlinedIcon />
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
