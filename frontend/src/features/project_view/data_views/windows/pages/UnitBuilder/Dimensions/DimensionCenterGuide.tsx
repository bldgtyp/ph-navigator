import { Box } from '@mui/material';

import { DIMENSION_GUIDE_DOT_SIZE_PX, DIMENSION_GUIDE_LINE_THICKNESS_PX } from './constants';

type DimensionCenterGuideProps = {
    orientation: 'horizontal' | 'vertical';
    positions: number[];
    length: number;
    lineOffsetPx?: number;
    color?: string;
    dotSizePx?: number;
    lineThicknessPx?: number;
};

const DimensionCenterGuide: React.FC<DimensionCenterGuideProps> = ({
    orientation,
    positions,
    length,
    lineOffsetPx = 0,
    color = 'grey.500',
    dotSizePx = DIMENSION_GUIDE_DOT_SIZE_PX,
    lineThicknessPx = DIMENSION_GUIDE_LINE_THICKNESS_PX,
}) => {
    if (orientation === 'horizontal') {
        return (
            <>
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: `${lineOffsetPx}px`,
                        width: '100%',
                        height: `${lineThicknessPx}px`,
                        bgcolor: color,
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}
                />
                {positions.map((location, index) => (
                    <Box
                        key={`col-guide-dot-${index}`}
                        aria-hidden
                        sx={{
                            position: 'absolute',
                            left: `${location}px`,
                            top: `${lineOffsetPx}px`,
                            width: `${dotSizePx}px`,
                            height: `${dotSizePx}px`,
                            bgcolor: color,
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                            zIndex: 0,
                        }}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            <Box
                aria-hidden
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${lineThicknessPx}px`,
                    height: `${length}px`,
                    bgcolor: color,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />
            {positions.map((location, index) => (
                <Box
                    key={`row-guide-dot-${index}`}
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        top: `${location}px`,
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${dotSizePx}px`,
                        height: `${dotSizePx}px`,
                        bgcolor: color,
                        borderRadius: '50%',
                        pointerEvents: 'none',
                        zIndex: 0,
                    }}
                />
            ))}
        </>
    );
};

export default DimensionCenterGuide;
