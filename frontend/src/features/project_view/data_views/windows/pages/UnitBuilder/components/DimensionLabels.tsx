// Update DimensionLabels.tsx
import React from 'react';
import { Box, Typography, Divider } from '@mui/material';

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
    // Calculate cumulative positions for labels
    const calculatePositions = (sizes: number[]) => {
        const positions: number[] = [];
        let current = 0;

        // Start position
        positions.push(0);

        // Accumulate positions for each grid line
        for (const size of sizes) {
            current += size;
            positions.push(current);
        }

        return positions;
    };

    const columnPositions = calculatePositions(columnWidths);
    const rowPositions = calculatePositions(rowHeights);

    const totalWidth = columnPositions[columnPositions.length - 1];
    const totalHeight = rowPositions[rowPositions.length - 1];

    return (
        <>
            {/* Vertical dimension lines (left side) */}
            <Box
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
                {rowPositions.map((position, index) => (
                    <Box
                        key={`row-label-${index}`}
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
                        <Typography variant="caption" sx={{ mr: 1 }}>
                            {position} {index === rowPositions.length - 1 ? units : ''}
                        </Typography>
                        <Box
                            sx={{
                                width: labelSpacing,
                                height: '1px',
                                bgcolor: 'grey.500',
                            }}
                        />
                    </Box>
                ))}

                {/* Total height label */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        right: labelSpacing * 3,
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
                sx={{
                    position: 'absolute',
                    left: 0,
                    top: '100%',
                    width: '100%',
                    height: labelSpacing * 4,
                    display: 'flex',
                }}
            >
                {columnPositions.map((position, index) => (
                    <Box
                        key={`col-label-${index}`}
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
                        <Typography variant="caption" sx={{ mt: 1 }}>
                            {position} {index === columnPositions.length - 1 ? units : ''}
                        </Typography>
                    </Box>
                ))}

                {/* Total width label */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: '50%',
                        bottom: 0,
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
