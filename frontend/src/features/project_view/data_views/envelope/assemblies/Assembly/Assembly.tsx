import React, { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';

import { postWithAlert } from '../../../../../../api/postWithAlert';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { deleteWithAlert } from '../../../../../../api/deleteWithAlert';

import Layer from '../Layer/Layer';
import AssemblyLegend from './AssemblyLegend';
import { LayerType } from '../../_types/Layer';
import { AssemblyType } from '../../_types/Assembly';

const Assembly: React.FC<{ assembly: AssemblyType }> = ({ assembly }) => {
    const [layers, setLayers] = useState(assembly.layers);

    useEffect(() => {
        setLayers(assembly.layers);
    }, [assembly]);

    const insertLayerAtOrder = async (orderPosition: number) => {
        try {
            // orderPosition already reflects the visual order shown to the user; the backend expects the same index.
            const response = await postWithAlert<LayerType>(`assembly/create-new-layer/${assembly.id}`, null, {
                order: orderPosition,
            });

            if (!response) {
                return;
            }

            const newLayerId = response.id;
            try {
                const newLayer = await getWithAlert<LayerType>(`assembly/get-layer/${newLayerId}`, null);
                if (!newLayer) {
                    return;
                }

                setLayers(currentLayers => {
                    const updatedLayers = [...currentLayers];
                    const insertIndex = Math.min(Math.max(newLayer.order, 0), updatedLayers.length);
                    updatedLayers.splice(insertIndex, 0, newLayer);
                    updatedLayers.forEach((segment, index) => {
                        segment.order = index;
                    });
                    return updatedLayers;
                });
            } catch (error) {
                console.error('Failed to get layer:', error);
            }
        } catch (error) {
            console.error('Failed to add layer:', error);
        }
    };

    const onAddLayerAbove = async (layer: LayerType) => {
        await insertLayerAtOrder(layer.order);
    };

    const onAddLayerBelow = async (layer: LayerType) => {
        await insertLayerAtOrder(layer.order + 1);
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

    const handleSegmentsChange = useCallback((layerId: number, segments: LayerType['segments']) => {
        setLayers(currentLayers => {
            const layerIndex = currentLayers.findIndex(layer => layer.id === layerId);
            if (layerIndex === -1) return currentLayers;

            const targetLayer = currentLayers[layerIndex];
            if (targetLayer.segments === segments) return currentLayers;

            const nextLayers = [...currentLayers];
            nextLayers[layerIndex] = { ...targetLayer, segments };
            return nextLayers;
        });
    }, []);

    const assemblyWithLayers = { ...assembly, layers };

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
                            onAddLayerAbove={onAddLayerAbove}
                            onAddLayerBelow={onAddLayerBelow}
                            onDeleteLayer={onDeleteLayer}
                            onSegmentsChange={handleSegmentsChange}
                        />
                    );
                })}
            </Box>

            <Box className="assembly-orientation-text">
                {(assembly.orientation === 'last_layer_outside' && 'exterior') || 'interior'}
            </Box>

            <AssemblyLegend assembly={assemblyWithLayers} />
        </Box>
    );
};

export default Assembly;
