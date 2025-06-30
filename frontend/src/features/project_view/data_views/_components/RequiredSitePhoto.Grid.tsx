import { Box, Grid, Typography } from '@mui/material';
import RequiredSitePhoto, { RequiredSitePhotoProps } from './RequiredSitePhoto';
import Markdown from 'markdown-to-jsx';
import DOMPurify from 'dompurify';

export interface SitePhotosGridProps {
    title: string;
    requiredPhotos: { src: string; captions: string[] }[];
}

const RequiredSitePhotosGrid: React.FC<SitePhotosGridProps> = ({ title, requiredPhotos }) => {
    return (
        <Box padding={3}>
            <Typography sx={{ pb: 4 }}>
                <Markdown>{DOMPurify.sanitize(title)}</Markdown>
            </Typography>
            <Grid className="grid-container" container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                {Object.entries(requiredPhotos).map(([key, imageData]) => (
                    <Grid className="grid-item" key={key} size={{ xs: 2, sm: 4, md: 4 }}>
                        <RequiredSitePhoto src={imageData.src} number={Number(key) + 1} captions={imageData.captions} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default RequiredSitePhotosGrid;
