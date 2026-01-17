import { useContext, useState } from 'react';
import { Box, ClickAwayListener, TextField, Typography } from '@mui/material';

import { useApertures } from '../../../../_contexts/Aperture.Context';
import { useZoom } from '../Zoom.Context';
import { useViewDirection } from '../ViewDirection.Context';
import { getDisplayColumnIndex, getDisplayColumnWidths } from './viewFlipUtils';
import { UserContext } from '../../../../../../../auth/_contexts/UserContext';

const ElementLabelEditable: React.FC<{
    elementName: string;
    onConfirm: (newValue: string) => void;
    onCancel: () => void;
}> = ({ elementName, onConfirm, onCancel }) => {
    const [editingValue, setEditingValue] = useState(elementName);

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
        <ClickAwayListener onClickAway={handleConfirm}>
            <TextField
                size="small"
                autoFocus
                value={editingValue}
                onChange={e => setEditingValue(e.target.value)}
                onKeyDown={handleKeyDown}
                variant="outlined"
                sx={{
                    minWidth: '80px',
                    maxWidth: '150px',
                    '& .MuiInputBase-root': {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '4px',
                    },
                    '& .MuiInputBase-input': {
                        py: 0.25,
                        px: 0.75,
                        fontSize: '0.75rem',
                        fontWeight: 'medium',
                        textAlign: 'center',
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
    );
};

const ElementLabel: React.FC<{
    element: any;
    width: number;
    height: number;
    columnWidths: number[];
    rowHeights: number[];
    columnIndexOverride?: number;
}> = ({ element, width, height, columnWidths, rowHeights, columnIndexOverride }) => {
    const userContext = useContext(UserContext);
    const { updateApertureElementName } = useApertures();
    const [isEditing, setIsEditing] = useState(false);

    const elementName = element.name || `Element ${element.id}`;

    // Calculate the left position by summing up column widths up to the start column
    // then adding half the element's total width
    const columnIndex = columnIndexOverride ?? element.column_number;
    const leftOffsetToStart = columnWidths.slice(0, columnIndex).reduce((sum, w) => sum + w, 0);
    const leftPosition = leftOffsetToStart + width / 2;

    // Calculate the top position by summing up row heights up to the start row
    // then adding half the element's total height
    const topOffsetToStart = rowHeights.slice(0, element.row_number).reduce((sum, h) => sum + h, 0);
    const topPosition = topOffsetToStart + height / 2;

    const handleEditStart = () => {
        if (userContext.user) {
            setIsEditing(true);
        }
    };

    const handleEditConfirm = async (newName: string) => {
        try {
            if (newName.trim() !== '' && newName !== elementName) {
                await updateApertureElementName(element.id, newName.trim());
            }
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update element name:', error);
            alert('Failed to update element name. Please try again.');
            setIsEditing(false);
        }
    };

    const handleEditCancel = () => {
        setIsEditing(false);
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                left: `${leftPosition}px`,
                top: `${topPosition}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
                pointerEvents: userContext.user || isEditing ? 'auto' : 'none',
                cursor: userContext.user ? 'pointer' : 'default',
            }}
        >
            {isEditing && userContext.user ? (
                <ElementLabelEditable
                    elementName={elementName}
                    onConfirm={handleEditConfirm}
                    onCancel={handleEditCancel}
                />
            ) : (
                <Typography
                    variant="caption"
                    title={userContext.user ? 'Click to edit element name' : elementName}
                    sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        fontSize: '0.75rem',
                        fontWeight: 'medium',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        maxWidth: '120px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        '&:hover': userContext.user
                            ? {
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                              }
                            : {},
                    }}
                    onClick={handleEditStart}
                >
                    {elementName}
                </Typography>
            )}
        </Box>
    );
};

const ElementLabelsOverlay: React.FC = () => {
    const { activeAperture, getCellSize } = useApertures();
    const { scaleFactor } = useZoom();
    const { isInsideView } = useViewDirection();

    if (!activeAperture) {
        return null;
    }

    return (
        <Box
            className="element-labels-overlay"
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
            }}
        >
            {Array.from(activeAperture.elements.values()).map(element => {
                const { width, height } = getCellSize(
                    element.row_number,
                    element.column_number,
                    element.row_span,
                    element.col_span
                );

                const displayColumnIndex = getDisplayColumnIndex(
                    element.column_number,
                    element.col_span,
                    activeAperture.column_widths_mm.length,
                    isInsideView
                );

                const displayColumnWidths = getDisplayColumnWidths(
                    activeAperture.column_widths_mm.map(w => w * scaleFactor),
                    isInsideView
                );

                return (
                    <ElementLabel
                        key={`label-${element.id}`}
                        element={element}
                        width={width * scaleFactor}
                        height={height * scaleFactor}
                        columnWidths={displayColumnWidths}
                        rowHeights={activeAperture.row_heights_mm.map(h => h * scaleFactor)}
                        columnIndexOverride={displayColumnIndex}
                    />
                );
            })}
        </Box>
    );
};

export default ElementLabelsOverlay;
