import React, { useEffect } from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import ContentBlock from '../../../_components/ContentBlock';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import LoadingModal from '../../../_components/LoadingModal';
import WindowGrid from './components/WindowGrid';
import { useWindowGrid } from './hooks/useWindowGrid';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { useParams } from 'react-router-dom';
import { ApertureType } from './types';

const WindowUnitDisplay: React.FC = () => {
    const {
        gridData,
        isPositionOccupied,
        addRow,
        addColumn,
        addSash,
        getCellSize,
        updateColumnWidth,
        updateRowHeight,
        selectedCells,
        toggleCellSelection,
        clearSelection,
        mergeSelectedCells,
    } = useWindowGrid();

    const { projectId } = useParams();
    const [apertures, setApertures] = React.useState<ApertureType[]>([]);
    const [selectedApertureId, setSelectedApertureId] = React.useState<string | null>(null);
    const [isLoadingApertures, setIsLoadingApertures] = React.useState<boolean>(false);

    const fetchApertures = async () => {
        console.log('fetchApertures', projectId);
        setIsLoadingApertures(true);
        try {
            const response = await getWithAlert<ApertureType[]>(`aperture/get-apertures/${projectId}`);
            console.log('Fetched apertures:', response);
            setApertures(response ?? []);
            return response ?? [];
        } catch (error) {
            console.error('Failed to fetch apertures:', error);
            return [];
        } finally {
            setIsLoadingApertures(false);
        }
    };

    useEffect(() => {
        console.log('useEffect called', projectId);
        const initializeApertures = async () => {
            const fetchedApertures = await fetchApertures();
            if (fetchedApertures.length > 0) {
                setSelectedApertureId(fetchedApertures[0].id); // Set the first aperture as selected
            } else {
                setSelectedApertureId(null); // No apertures available
            }
        };

        initializeApertures();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <Box>
            <Box mb={2} display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                <Button variant="contained" onClick={addColumn}>
                    Add Column
                </Button>
                <Button variant="contained" onClick={addRow}>
                    Add Row
                </Button>

                <Tooltip title={selectedCells.length <= 1 ? 'Select multiple adjacent cells to merge' : ''}>
                    <span>
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={mergeSelectedCells}
                            disabled={selectedCells.length <= 1}
                        >
                            Merge Selected ({selectedCells.length})
                        </Button>
                    </span>
                </Tooltip>

                {selectedCells.length > 0 && (
                    <Button variant="outlined" onClick={clearSelection}>
                        Clear Selection
                    </Button>
                )}
            </Box>

            <WindowGrid
                gridData={gridData}
                isPositionOccupied={isPositionOccupied}
                addSash={addSash}
                getCellSize={getCellSize}
                updateColumnWidth={updateColumnWidth}
                updateRowHeight={updateRowHeight}
                selectedCells={selectedCells}
                toggleCellSelection={toggleCellSelection}
            />
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
