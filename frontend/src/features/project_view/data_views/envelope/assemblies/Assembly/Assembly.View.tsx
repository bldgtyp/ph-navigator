import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';

import { postWithAlert } from '../../../../../../api/postWithAlert';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { deleteWithAlert } from '../../../../../../api/deleteWithAlert';

import Layer from '../Layer/Layer';
import { LayerType } from '../../_types/Layer';
import { AssemblyType } from '../../_types/Assembly';

const AssemblyView: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const [layers, setLayers] = useState(assembly.layers);

    useEffect(() => {
        setLayers(assembly.layers);
    }, [assembly]);

    const onAddLayerBelow = async (layer: LayerType) => {
        // Add the Layer
        try {
            // New Segment goes to the right of the current segment
            const orderPosition = layer.order + 1;

            // Call the backend API to add the new segment
            const response = await postWithAlert<LayerType>(`assembly/create-new-layer/${assembly.id}`, null, {
                order: orderPosition,
            });

            if (response) {
                const newLayerId = response.id;

                // Get the new Layer for display
                try {
                    const newLayer = await getWithAlert<LayerType>(`assembly/get-layer/${newLayerId}`, null);
                    if (newLayer) {
                        // Update the layers array to reflect the insertion
                        const updatedLayers = [...layers];
                        updatedLayers.splice(newLayer.order, 0, newLayer); // Insert the new layer
                        updatedLayers.forEach((segment, index) => {
                            segment.order = index; // Recalculate the order for all Layers
                        });

                        setLayers(updatedLayers);
                    }
                } catch (error) {
                    console.error('Failed to get layer:', error);
                }
            }
        } catch (error) {
            console.error('Failed to add segment:', error);
        }
    };

    const onDeleteLayer = async (layerId: number) => {
        try {
            // Call the backend API to delete the layer
            const response = await deleteWithAlert<{ message: string }>(`assembly/delete-layer/${layerId}`, null);

            if (response) {
                // Remove the layer from the local state
                const updatedLayers = layers.filter(layer => layer.id !== layerId);

                // Recalculate the order for the remaining layers
                updatedLayers.forEach((layer, index) => {
                    layer.order = index;
                });

                setLayers(updatedLayers);
            }
        } catch (error) {
            console.error('Failed to delete layer:', error);
        }
    };

    return (
        <Box className="assembly-container" sx={{ margin: 4 }}>
            <Box className="assembly-orientation-text">
                {(assembly.orientation === 'first_layer_outside' && 'exterior') || 'interior'}
            </Box>
            <Box className="assembly-layers">
                {layers.map((layer: LayerType) => {
                    return (
                        <Layer
                            key={layer.id}
                            layer={layer}
                            onAddLayer={onAddLayerBelow}
                            onDeleteLayer={onDeleteLayer}
                        />
                    );
                })}
            </Box>

            <Box className="assembly-orientation-text">
                {(assembly.orientation === 'last_layer_outside' && 'exterior') || 'interior'}
            </Box>
        </Box>
    );
};

export default AssemblyView;
