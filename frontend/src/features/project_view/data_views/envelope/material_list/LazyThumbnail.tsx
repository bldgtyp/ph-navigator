import React, { useState } from 'react';
import { Box, Skeleton } from '@mui/material';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';

interface LazyThumbnailProps<T extends { thumbnail_url: string }> {
    image: T;
    idx: number;
    setSelectedImage: (item: T) => void;
}

const LazyThumbnail = <T extends { thumbnail_url: string }>(props: LazyThumbnailProps<T>) => {
    const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');

    return (
        <Box
            className="thumbnail-wrapper"
            sx={{
                position: 'relative',
                minWidth: 64,
                minHeight: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {loadState === 'loading' && (
                <Skeleton variant="rectangular" width={64} height={64} sx={{ position: 'absolute' }} />
            )}
            {loadState === 'error' && <BrokenImageIcon sx={{ color: '#999', fontSize: 32 }} />}
            <img
                className="thumbnail"
                src={props.image.thumbnail_url}
                alt={`Photo ${props.idx + 1}`}
                style={{
                    display: loadState === 'loaded' ? 'block' : 'none',
                    cursor: 'pointer',
                }}
                onLoad={() => setLoadState('loaded')}
                onError={() => setLoadState('error')}
                onClick={() => props.setSelectedImage(props.image)}
            />
        </Box>
    );
};

export default LazyThumbnail;
