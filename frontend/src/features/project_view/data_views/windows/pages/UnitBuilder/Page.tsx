import { Box, Button } from '@mui/material';
import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import { useState } from 'react';

const Sash: React.FC<{ height: number; width: number }> = ({ height, width }) => {
    return (
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <rect x="0" y="0" width={width} height="10" fill="white" stroke="black" />
            <rect x={width - 10} y="0" width="10" height={height} fill="white" stroke="black" />
            <rect x="0" y={height - 10} width={width} height="10" fill="white" stroke="black" />
            <rect x="0" y="0" width="10" height={height} fill="white" stroke="black" />
        </svg>
    );
};

type GridCell = {
    sash?: {
        id: string;
        // Optional sash metadata (type, product ref, etc)
    };
    rowSpan?: number;
    colSpan?: number;
};

const getGridCellSize = (
    rowIndex: number,
    colIndex: number,
    rowSpan: number,
    colSpan: number,
    columnWidths: number[],
    rowHeights: number[]
) => {
    const width = columnWidths.slice(colIndex, colIndex + colSpan).reduce((sum, w) => sum + w, 0);
    const height = rowHeights.slice(rowIndex, rowIndex + rowSpan).reduce((sum, h) => sum + h, 0);
    return { width, height };
};

const WindowUnitDisplay: React.FC = () => {
    const [rowHeights, setRowHeights] = useState<number[]>([100, 200]);
    const [columnWidths, setColumnWidths] = useState<number[]>([100, 200, 100]);

    // Note: Grid must be 'even' in both dimensions. Use 'null' to pad after any span cells.
    const [windowCells, setWindowCells] = useState<(GridCell | null)[][]>([
        [{ sash: { id: 'a' }, colSpan: 2 }, null, { sash: { id: 'd' }, rowSpan: 2 }],
        [{ sash: { id: 'b' } }, { sash: { id: 'c' } }, null],
    ]);

    const handleAddNewRow = () => {
        setRowHeights([...rowHeights, 100]);
        // Add a new row with empty cells for each column
        setWindowCells([...windowCells, columnWidths.map(() => null)]);
    };

    const handleAddNewColumn = () => {
        console.log('Adding new column');
        // Add a new Column to the Grid
        setColumnWidths([...columnWidths, 100]);

        // Add a new column with empty cells for each existing row
        setWindowCells(prevCells => {
            const newCells = prevCells.map(row => [...row]); // clone all rows
            newCells.forEach(row => {
                row.push(null); // add a new empty cell to each row
            });
            return newCells;
        });
    };

    const handleAddSash = (rowIndex: number, colIndex: number) => {
        console.log(`Adding sash at row ${rowIndex}, col ${colIndex}`);
        setWindowCells(prevCells => {
            const newCells = prevCells.map(row => [...row]); // clone all rows

            newCells[rowIndex][colIndex] = {
                ...newCells[rowIndex][colIndex],
                sash: { id: `new-${Date.now()}` },
            };

            return newCells;
        });
    };

    return (
        <Box>
            <Button onClick={handleAddNewColumn}>Add New Column</Button>
            <Button onClick={handleAddNewRow}>Add New Row</Button>

            <Box className="window-cells-container" sx={{ position: 'relative' }}>
                {/* Main grid with cells */}
                <Box
                    className="window-cells"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: columnWidths.map(w => `${w}px`).join(' '),
                        gridTemplateRows: rowHeights.map(h => `${h}px`).join(' '),
                        gap: 0,
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {windowCells.map((row, rowIndex) =>
                        row.map((cell, colIndex) => {
                            if (!cell) {
                                return null;
                            }

                            const key = `${rowIndex}-${colIndex}`;
                            const colSpan = cell?.colSpan || 1;
                            const rowSpan = cell?.rowSpan || 1;
                            const { width, height } = getGridCellSize(
                                rowIndex,
                                colIndex,
                                rowSpan,
                                colSpan,
                                columnWidths,
                                rowHeights
                            );
                            return (
                                <Box
                                    className="window-cell"
                                    key={key}
                                    sx={{
                                        // Have to explicitly set start/end to handle empty cells
                                        gridRowStart: rowIndex + 1,
                                        gridRowEnd: rowIndex + 1 + rowSpan,
                                        gridColumnStart: colIndex + 1,
                                        gridColumnEnd: colIndex + 1 + colSpan,
                                        position: 'relative',
                                    }}
                                >
                                    {cell?.sash && <Sash height={height} width={width} />}
                                </Box>
                            );
                        })
                    )}
                </Box>

                {/* Grid lines overlay */}
                <Box
                    className="window-grid-lines"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: columnWidths.map(w => `${w}px`).join(' '),
                        gridTemplateRows: rowHeights.map(h => `${h}px`).join(' '),
                        gap: 0,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2,
                        // pointerEvents: 'none', // Let clicks pass through to the window cells below
                    }}
                >
                    {rowHeights.map((rowHeight, rowIndex) =>
                        columnWidths.map((columnHeight, colIndex) => {
                            if (windowCells[rowIndex][colIndex]) {
                                return null;
                            } else {
                                return (
                                    <Box
                                        className="window-gridline-cell"
                                        key={`gridline-${rowIndex}-${colIndex}`}
                                        sx={{
                                            gridColumn: `${colIndex + 1}`,
                                            gridRow: `${rowIndex + 1}`,
                                            boxSizing: 'border-box',
                                            border: '1px dashed lightgrey',
                                            position: 'relative',
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    >
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                zIndex: 3,
                                            }}
                                            onClick={() => handleAddSash(rowIndex, colIndex)}
                                        >
                                            +
                                        </Button>
                                    </Box>
                                );
                            }
                        })
                    )}
                </Box>
            </Box>
        </Box>
    );
};

const WindowUnits: React.FC = () => {
    return (
        <ContentBlock>
            <LoadingModal showModal={false} />
            <ContentBlockHeader text="Window & Door Builder" />
            <Box p={2}>
                <WindowUnitDisplay />
            </Box>
        </ContentBlock>
    );
};

export default WindowUnits;
