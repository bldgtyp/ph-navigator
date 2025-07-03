// Calculate positions for grid lines and segment sizes
export const calculateSegments = (sizes: number[]) => {
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
