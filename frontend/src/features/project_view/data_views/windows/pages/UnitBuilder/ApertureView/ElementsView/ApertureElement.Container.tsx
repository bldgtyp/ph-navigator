import { Box } from '@mui/material';

import { useApertures } from '../../../../_contexts/Aperture.Context';
import { useZoom } from '../Zoom.Context';

import ApertureElementSVG from './ApertureElement.SVG';
import { useViewDirection } from '../ViewDirection.Context';
import { ApertureElementContainerProps } from './types';
import { useCopyPaste } from '../CopyPaste.Context';

const PICK_CURSOR =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23000'><path d='m20.71 5.63-2.34-2.34a.996.996 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42M6.92 19 5 17.08l8.06-8.06 1.92 1.92z'/></svg>\") 4 20, copy";
const PASTE_CURSOR =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23000'><path d='M16.56 8.94 7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12M5.21 10 10 5.21 14.79 10zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5M2 20h20v4H2z'/></svg>\") 6 22, copy";

const ApertureElementContainer: React.FC<ApertureElementContainerProps> = ({
    element,
    width,
    height,
    isSelected,
    gridColumnStart,
    gridColumnEnd,
}) => {
    const { toggleApertureElementSelection, clearApertureElementIdSelection } = useApertures();
    const { scaleFactor } = useZoom();
    const { isInsideView } = useViewDirection();
    const { isPickMode, isPasteMode, startPasteMode, pasteToElement, lastPastedElementId } = useCopyPaste();

    const isPasted = lastPastedElementId === element.id;

    const handleElementClick = (event: React.MouseEvent) => {
        event.stopPropagation();

        if (isPasteMode) {
            pasteToElement(element.id);
            return;
        }

        if (isPickMode) {
            startPasteMode(element);
            clearApertureElementIdSelection();
            return;
        }

        toggleApertureElementSelection(element.id);
    };

    return (
        <Box
            className={`aperture-element ${isSelected ? 'selected' : ''}`}
            onClick={handleElementClick}
            sx={{
                gridRowStart: element.row_number + 1,
                gridRowEnd: element.row_number + 1 + element.row_span,
                gridColumnStart: gridColumnStart ?? element.column_number + 1,
                gridColumnEnd: gridColumnEnd ?? element.column_number + 1 + element.col_span,
                position: 'relative',
                cursor: isPasteMode ? PASTE_CURSOR : isPickMode ? PICK_CURSOR : 'pointer',
                border: isSelected ? '2px solid #1976d2' : '1px solid #ddd',
                backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                    backgroundColor:
                        isPasteMode || isPickMode
                            ? 'rgba(255, 193, 7, 0.12)'
                            : isSelected
                              ? 'rgba(25, 118, 210, 0.2)'
                              : 'rgba(0, 0, 0, 0.04)',
                    borderColor: isPasteMode || isPickMode ? 'rgba(255, 193, 7, 0.8)' : undefined,
                },
                animation: isPasted ? 'pastePulse 600ms ease-out' : undefined,
                '@keyframes pastePulse': {
                    '0%': {
                        boxShadow: '0 0 0 0 rgba(255, 193, 7, 0.6)',
                    },
                    '70%': {
                        boxShadow: '0 0 0 8px rgba(255, 193, 7, 0)',
                    },
                    '100%': {
                        boxShadow: '0 0 0 0 rgba(255, 193, 7, 0)',
                    },
                },
            }}
        >
            <ApertureElementSVG
                height={height}
                width={width}
                element={element}
                scaleFactor={scaleFactor}
                isInsideView={isInsideView}
            />
        </Box>
    );
};

export default ApertureElementContainer;
