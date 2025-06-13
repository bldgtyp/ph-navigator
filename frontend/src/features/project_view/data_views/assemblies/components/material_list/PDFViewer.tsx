import React, { useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

interface PDFViewerProps {
    url: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = () => {
        setIsLoading(false);
        setError("Failed to load PDF");
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '70vh' }}>
            {isLoading && (
                <Box sx={{
                    position: 'absolute',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%'
                }}>
                    <CircularProgress />
                </Box>
            )}

            {error ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                    <PictureAsPdfIcon sx={{ fontSize: 60, color: 'error.main' }} />
                    <Typography color="error">Failed to load PDF</Typography>
                    <Typography variant="body2">
                        <a href={url} target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
                    </Typography>
                </Box>
            ) : (
                <iframe
                    src={`${url}#toolbar=0`}
                    title="PDF Viewer"
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}
        </Box>
    );
};

export default PDFViewer;