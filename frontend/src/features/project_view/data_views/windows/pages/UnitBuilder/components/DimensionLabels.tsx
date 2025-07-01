import React from 'react';
import { Box, Typography } from '@mui/material';

interface DimensionLabelsProps {
    rowHeights: number[];
    columnWidths: number[];
    labelSpacing?: number;
    units?: string;
}

const DimensionLabels: React.FC<DimensionLabelsProps> = ({
    rowHeights,
    columnWidths,
    labelSpacing = 10,
    units = 'mm',
}) => {
    // Calculate positions for grid lines and segment sizes
    const calculateSegments = (sizes: number[]) => {
        const positions: number[] = [];
        const segments: number[] = [];
        let current = 0;

        // Start position
        positions.push(0);

        // Calculate positions and segments
        for (const size of sizes) {
            segments.push(size); // Store the actual size between points
            current += size;
            positions.push(current);
        }

        return { positions, segments };
    };

    const { positions: columnPositions, segments: columnSegments } = calculateSegments(columnWidths);
    const { positions: rowPositions, segments: rowSegments } = calculateSegments(rowHeights);

    const totalWidth = columnPositions[columnPositions.length - 1];
    const totalHeight = rowPositions[rowPositions.length - 1];

    return (
        <>
            {/* Vertical dimension lines (left side) */}
            <Box
                id="dimensions-left"
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: -labelSpacing * 5,
                    height: '100%',
                    width: labelSpacing * 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                }}
            >
                {/* Grid line positions */}
                {rowPositions.map((position, index) => (
                    <Box
                        key={`row-position-${index}`}
                        sx={{
                            position: 'absolute',
                            top: `${position}px`,
                            right: 0,
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            height: '20px',
                        }}
                    >
                        <Box
                            sx={{
                                width: labelSpacing,
                                height: '1px',
                                bgcolor: 'grey.500',
                            }}
                        />
                    </Box>
                ))}

                {/* Segment measurements (between grid lines) */}
                {rowSegments.map((height, index) => (
                    <Box
                        key={`row-segment-${index}`}
                        sx={{
                            position: 'absolute',
                            top: `${rowPositions[index] + height / 2}px`,
                            right: labelSpacing + 5,
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            height: '20px',
                        }}
                    >
                        <Typography variant="caption" sx={{ mr: 1 }}>
                            {height} {units}
                        </Typography>
                    </Box>
                ))}

                {/* Total height label */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        right: labelSpacing * 4.5,
                        transform: 'translateY(-50%) rotate(-90deg)',
                        transformOrigin: 'right center',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                        Total: {totalHeight} {units}
                    </Typography>
                </Box>
            </Box>

            {/* Horizontal dimension lines (bottom) */}
            <Box
                id="dimensions-bottom"
                sx={{
                    position: 'absolute',
                    left: 0,
                    top: '100%',
                    width: '100%',
                    height: labelSpacing * 4,
                    display: 'flex',
                }}
            >
                {/* Grid line positions */}
                {columnPositions.map((position, index) => (
                    <Box
                        key={`col-position-${index}`}
                        sx={{
                            position: 'absolute',
                            left: `${position}px`,
                            top: 0,
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Box
                            sx={{
                                height: labelSpacing,
                                width: '1px',
                                bgcolor: 'grey.500',
                            }}
                        />
                    </Box>
                ))}

                {/* Segment measurements (between grid lines) */}
                {columnSegments.map((width, index) => (
                    <Box
                        key={`col-segment-${index}`}
                        sx={{
                            position: 'absolute',
                            left: `${columnPositions[index] + width / 2}px`,
                            top: labelSpacing + 5,
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="caption">
                            {width} {units}
                        </Typography>
                    </Box>
                ))}

                {/* Total width label */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: -labelSpacing * 2,
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        mt: 3,
                    }}
                >
                    <Typography variant="body2" fontWeight="bold">
                        Total: {totalWidth} {units}
                    </Typography>
                </Box>
            </Box>
        </>
    );
};

export default DimensionLabels;
