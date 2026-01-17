import './styles.css';
import { useContext, useState } from 'react';
import { Box, ClickAwayListener, Grid, TextField, Typography } from '@mui/material';

import { TableHeader } from './TableHeader';
import { GlazingRow, FrameRow } from './TableRows';
import { TableGroupProps } from './types';
import { useApertures } from '../../../_contexts/Aperture.Context';
import { UserContext } from '../../../../../../auth/_contexts/UserContext';
import { useViewDirection } from '../ApertureView/ViewDirection.Context';

const GroupTitle: React.FC<{ handleEditStart: () => void; title: string }> = ({ handleEditStart, title }) => {
    return (
        <Grid size={12} sx={{ fontWeight: 'bold', mb: 1 }}>
            <Typography
                variant="h5"
                sx={{
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    px: 1,
                    borderRadius: 1,
                    '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.05)',
                    },
                }}
                onClick={handleEditStart}
            >
                {title}
            </Typography>
        </Grid>
    );
};

const GroupTitleEditable: React.FC<{
    title: string;
    onConfirm: (newValue: string) => void;
    onCancel: () => void;
}> = ({ title, onConfirm, onCancel }) => {
    const [editingValue, setEditingValue] = useState(title);

    const handleConfirm = () => {
        onConfirm(editingValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <Grid size={12} sx={{ fontWeight: 'bold', mb: 1 }}>
            <ClickAwayListener onClickAway={handleConfirm}>
                <TextField
                    size="small"
                    autoFocus
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    variant="outlined"
                    sx={{
                        width: '200px',
                        '& .MuiInputBase-input': {
                            py: 0.5,
                            px: 1,
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                        },
                    }}
                    slotProps={{
                        input: {
                            onFocus: event => {
                                event.target.select();
                            },
                        },
                    }}
                />
            </ClickAwayListener>
        </Grid>
    );
};

export const ApertureElementTableGroup: React.FC<TableGroupProps> = ({ aperture, element, isSelected }) => {
    const userContext = useContext(UserContext);
    const { updateApertureElementName, activeAperture } = useApertures();
    const { isInsideView } = useViewDirection();
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Get the most current element data from activeAperture to ensure we have the latest state
    const currentElement = activeAperture?.elements.find(el => el.id === element.id) || element;
    const groupTitle = currentElement.name || `Element ${currentElement.id}`;

    const handleEditStart = () => {
        if (userContext.user) {
            setIsEditingTitle(true);
        }
    };

    const handleEditConfirm = async (newName: string) => {
        try {
            await updateApertureElementName(currentElement.id, newName);
            setIsEditingTitle(false);
        } catch (error) {
            console.error('Failed to update element name:', error);
            // Optionally show an error message to the user
            setIsEditingTitle(false);
        }
    };

    const handleEditCancel = () => {
        setIsEditingTitle(false);
    };

    return (
        <Box
            className="aperture-table-group"
            sx={{
                outline: isSelected ? '2px solid blue' : 'none',
                border: '1px solid var(--outline-color)',
                borderRadius: '4px',
                p: 0,
                mt: 2,
                fontSize: '0.75rem',
                boxSizing: 'border-box',
            }}
        >
            {/* Title Section */}
            <Grid
                container
                sx={{
                    margin: 1,
                    rowGap: '2px',
                    columnGap: '0px',
                }}
            >
                {isEditingTitle && userContext.user ? (
                    <GroupTitleEditable title={groupTitle} onConfirm={handleEditConfirm} onCancel={handleEditCancel} />
                ) : (
                    <GroupTitle handleEditStart={handleEditStart} title={groupTitle} />
                )}
                <TableHeader />
            </Grid>

            {/* Content Section with Zebra Striping */}
            <Grid
                container
                sx={{
                    margin: 1,
                    rowGap: '0px',
                    columnGap: '0px',
                }}
            >
                <GlazingRow
                    rowIndex={0}
                    aperture={aperture}
                    element={currentElement}
                    glazing={currentElement.glazing}
                />
                <FrameRow rowIndex={1} aperture={aperture} element={currentElement} position="top" label="Top Frame:" />
                <FrameRow
                    rowIndex={2}
                    aperture={aperture}
                    element={currentElement}
                    position={isInsideView ? 'left' : 'right'}
                    label="Right Frame:"
                />
                <FrameRow
                    rowIndex={3}
                    aperture={aperture}
                    element={currentElement}
                    position="bottom"
                    label="Bottom Frame:"
                />
                <FrameRow
                    rowIndex={4}
                    aperture={aperture}
                    element={currentElement}
                    position={isInsideView ? 'right' : 'left'}
                    label="Left Frame:"
                />
            </Grid>
        </Box>
    );
};
