import { Box, Button, Tooltip } from '@mui/material';

import { useApertures } from '../../../_contexts/Aperture.Context';

const ApertureEditButton: React.FC<{ onClick: () => void; text: string; hoverText?: string; disabled?: boolean }> = ({
    onClick,
    text,
    hoverText = '',
    disabled = false,
}) => {
    return (
        <Tooltip title={hoverText} placement="top" arrow>
            <span>
                <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    sx={{ minWidth: '120px', color: 'inherit' }}
                    onClick={onClick}
                    disabled={disabled}
                >
                    {text}
                </Button>
            </span>
        </Tooltip>
    );
};

const ApertureEditButtons: React.FC = () => {
    const {
        handleAddRow,
        handleAddColumn,
        selectedApertureElementIds,
        mergeSelectedApertureElements,
        clearApertureElementIdSelection,
        splitSelectedApertureElement,
    } = useApertures();

    return (
        <Box
            className="aperture-edit-buttons"
            display="flex"
            justifyContent="flex-start"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
        >
            {selectedApertureElementIds.length > 0 && (
                <ApertureEditButton onClick={clearApertureElementIdSelection} text="Clear Selection" />
            )}
            <ApertureEditButton
                onClick={mergeSelectedApertureElements}
                text={`Merge Selected (${selectedApertureElementIds.length})`}
                hoverText={selectedApertureElementIds.length <= 1 ? 'Select multiple Aperture-Elements to merge' : ''}
                disabled={selectedApertureElementIds.length < 2}
            />
            <ApertureEditButton
                onClick={splitSelectedApertureElement}
                text={'Split Selected'}
                hoverText={selectedApertureElementIds.length !== 1 ? 'Select one Aperture-Element to split' : ''}
                disabled={selectedApertureElementIds.length !== 1}
            />
            <ApertureEditButton onClick={handleAddColumn} text="Add Column" />
            <ApertureEditButton onClick={handleAddRow} text="Add Row" />
        </Box>
    );
};

export default ApertureEditButtons;
