import { useContext, useEffect } from 'react';
import { Box, Tooltip } from '@mui/material';

import { UserContext } from '../../../../../auth/_contexts/UserContext';
import { useUnitConversion } from '../../../../_hooks/useUnitConversion';

import Segment from '../Segment/Segment';
import ModalLayerThickness from '../LayerHeightModal/LayerHeight';
import { LayerType } from '../../_types/Layer';
import { SegmentType } from '../../_types/Segment';

import { useLayerHooks } from './Layer.Hooks';

interface LayerProps {
    layer: LayerType;
    onAddLayer: (layer: LayerType) => void;
    onDeleteLayer: (layerId: number) => void;
    onSegmentsChange?: (layerId: number, segments: SegmentType[]) => void;
}

const AddLayerButton: React.FC<{ onClick: () => void }> = props => {
    return (
        <Tooltip title="Add a New Layer" placement="bottom">
            <button
                className="add-layer-button"
                onClick={e => {
                    e.stopPropagation();
                    props.onClick();
                }}
            >
                +
            </button>
        </Tooltip>
    );
};

const Layer: React.FC<LayerProps> = ({ layer, onAddLayer, onDeleteLayer, onSegmentsChange }) => {
    const { valueInCurrentUnitSystemWithDecimal, unitSystem } = useUnitConversion();
    const userContext = useContext(UserContext);
    const hooks = useLayerHooks(layer);

    useEffect(() => {
        if (onSegmentsChange) {
            onSegmentsChange(layer.id, hooks.segments);
        }
    }, [hooks.segments, layer.id, onSegmentsChange]);

    const handleSegmentUpdated = (updatedSegment: SegmentType) => {
        hooks.setSegments(prevSegments =>
            prevSegments.map(segment =>
                segment.id === updatedSegment.id
                    ? {
                          ...segment,
                          ...updatedSegment,
                          material: updatedSegment.material ?? segment.material,
                          material_id: updatedSegment.material?.id ?? updatedSegment.material_id,
                      }
                    : segment
            )
        );
    };

    return (
        <Box className="assembly-layer">
            {/* Layer Left-Sidebar */}
            <Box
                className="assembly-layer-thickness"
                onClick={hooks.handleMouseClick}
                onMouseEnter={hooks.handleMouseEnter}
                onMouseLeave={hooks.handleMouseLeave}
            >
                {valueInCurrentUnitSystemWithDecimal(
                    hooks.layerThickness.currentValue,
                    'mm',
                    'in',
                    unitSystem === 'SI' ? 1 : 3
                )}

                {/* Add-Layer Button */}
                {hooks.isLayerHovered && userContext.user ? <AddLayerButton onClick={() => onAddLayer(layer)} /> : null}
            </Box>

            <ModalLayerThickness
                isModalOpen={hooks.isModalOpen}
                onModalClose={hooks.handleModalClose}
                layerThickness={hooks.layerThickness.newValue}
                onLayerThicknessChange={hooks.layerThickness.setNewValue}
                onSubmit={() => hooks.handleSubmitChangeLayerThickness(layer)}
                onDeleteLayer={() => onDeleteLayer(layer.id)}
            />

            {/* The actual Graphic elements for the Layers Segments */}
            <Box className="assembly-layer-segments" sx={{ height: hooks.layerThickness.currentValue }}>
                {hooks.segments.map(segment => (
                    <Segment
                        key={segment.id}
                        segment={segment}
                        onAddSegment={segment => hooks.handleAddSegmentToRight(segment, layer)}
                        onDeleteSegment={hooks.handleDeleteSegment}
                        onSegmentUpdated={handleSegmentUpdated}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default Layer;
