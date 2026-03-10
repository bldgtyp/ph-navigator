import React, { createContext, useContext, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { getWithAlert } from '../../../../../../api/getWithAlert';
import { queryKeys } from '../../../../../../api/queryKeys';

import { AssemblyType } from '../../_types/Assembly';
import { useAssembliesQuery } from '../_hooks/useAssembliesQuery';
import {
    useAddAssemblyMutation,
    useDeleteAssemblyMutation,
    useRenameAssemblyMutation,
    useFlipOrientationMutation,
    useFlipLayersMutation,
    useDuplicateAssemblyMutation,
    useUploadConstructionsMutation,
    useRefreshAssemblyMaterialsMutation,
} from '../_hooks/useAssemblyMutations';

export interface AssemblyContextType {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    isRefreshing: boolean;
    refreshMessage: string | null;
    isLoadingAssemblies: boolean;
    assemblies: AssemblyType[];
    selectedAssemblyId: number | null;
    setSelectedAssemblyId: React.Dispatch<React.SetStateAction<number | null>>;
    selectedAssembly: AssemblyType | null;
    refreshKey: number;
    triggerRefresh: () => void;
    rValueRefreshKey: number;
    triggerRValueRefresh: () => void;
    handleAssemblyChange: (assemblyId: number) => Promise<void>;
    handleAddAssembly: () => Promise<void>;
    handleDeleteAssembly: (assemblyId: number) => Promise<void>;
    handleNameChange: (assemblyId: number, newName: string) => Promise<void>;
    handleRefreshMaterials: () => Promise<void>;
    handleUploadConstructions: () => Promise<void>;
    handleDownloadConstructions: () => Promise<void>;
    handleFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleFlipOrientation: (assemblyId: number | null) => Promise<void>;
    handleFlipLayers: (assemblyId: number | null) => Promise<void>;
    handleDuplicateAssembly: (assemblyId: number | null) => Promise<void>;
    layerThicknessOverridesMm: Record<number, number>;
    setLayerThicknessOverrideMm: (layerId: number, thicknessMm: number) => void;
    clearLayerThicknessOverrides: () => void;
}

const AssemblyContext = createContext<AssemblyContextType | undefined>(undefined);

export const AssemblyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { projectId } = useParams();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- TanStack Query: data fetching ---
    const { assemblies, isLoadingAssemblies } = useAssembliesQuery();

    // --- TanStack Query: mutations ---
    const addMutation = useAddAssemblyMutation();
    const deleteMutation = useDeleteAssemblyMutation();
    const renameMutation = useRenameAssemblyMutation();
    const flipOrientationMutation = useFlipOrientationMutation();
    const flipLayersMutation = useFlipLayersMutation();
    const duplicateMutation = useDuplicateAssemblyMutation();
    const uploadMutation = useUploadConstructionsMutation();
    const refreshMaterialsMutation = useRefreshAssemblyMaterialsMutation();

    // --- UI state (not server state) ---
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [selectedAssemblyId, setSelectedAssemblyId] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState<number>(0);
    const [rValueRefreshKey, setRValueRefreshKey] = useState<number>(0);
    const [layerThicknessOverridesMm, setLayerThicknessOverridesMm] = useState<Record<number, number>>({});

    // --- Helpers ---
    const invalidateAssemblies = useCallback(() => {
        return queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
    }, [queryClient, projectId]);

    const setLayerThicknessOverride = useCallback((layerId: number, thicknessMm: number) => {
        setLayerThicknessOverridesMm(current => {
            if (current[layerId] === thicknessMm) return current;
            return { ...current, [layerId]: thicknessMm };
        });
    }, []);

    const clearLayerThicknessOverrides = useCallback(() => {
        setLayerThicknessOverridesMm({});
    }, []);

    const triggerRefresh = useCallback(() => {
        setRefreshKey(k => k + 1);
    }, []);

    const triggerRValueRefresh = useCallback(() => {
        setRValueRefreshKey(k => k + 1);
    }, []);

    // --- Select first assembly on initial load ---
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (!isLoadingAssemblies && !hasInitialized) {
            if (assemblies.length > 0) {
                setSelectedAssemblyId(assemblies[0].id);
            } else {
                setSelectedAssemblyId(null);
            }
            setHasInitialized(true);
        }
    }, [isLoadingAssemblies, assemblies, hasInitialized]);

    // Reset initialization when projectId changes
    useEffect(() => {
        setHasInitialized(false);
    }, [projectId]);

    const selectedAssembly = useMemo(() => {
        return assemblies.find(assembly => assembly.id === selectedAssemblyId) || null;
    }, [assemblies, selectedAssemblyId]);

    useEffect(() => {
        clearLayerThicknessOverrides();
    }, [clearLayerThicknessOverrides, selectedAssemblyId]);

    // --- Handlers ---
    const handleAssemblyChange = useCallback(
        async (assemblyId: number) => {
            setSelectedAssemblyId(assemblyId);
            await invalidateAssemblies();
            setRefreshKey(k => k + 1);
        },
        [invalidateAssemblies]
    );

    const handleAddAssembly = useCallback(async () => {
        const response = await addMutation.mutateAsync();
        if (response) {
            setSelectedAssemblyId(response.id);
        }
    }, [addMutation]);

    const handleDeleteAssembly = useCallback(
        async (assemblyId: number) => {
            const confirmed = window.confirm('Are you sure you want to delete the Assembly?');
            if (!confirmed) return;

            await deleteMutation.mutateAsync(assemblyId);

            // After invalidation completes, select the first assembly
            // The query cache will update `assemblies` via useAssembliesQuery
            // We need to wait for refetch, so we invalidate and read the new data
            const newData = await queryClient.fetchQuery({
                queryKey: queryKeys.assemblies(projectId || ''),
            });
            const updatedAssemblies = (newData as AssemblyType[]) ?? [];
            if (updatedAssemblies.length > 0) {
                setSelectedAssemblyId(updatedAssemblies[0].id);
            } else {
                setSelectedAssemblyId(null);
            }
        },
        [deleteMutation, queryClient, projectId]
    );

    const handleNameChange = useCallback(
        async (assemblyId: number, newName: string) => {
            await renameMutation.mutateAsync({ assemblyId, newName });
            setSelectedAssemblyId(assemblyId);
            setRefreshKey(k => k + 1);
        },
        [renameMutation]
    );

    const handleRefreshMaterials = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshMessage(null);
        try {
            await refreshMaterialsMutation.mutateAsync();
            setRefreshMessage('Materials refreshed successfully!');
        } catch (error) {
            setRefreshMessage('Error loading Material Data. Please try again later.');
            console.error('Error loading Material Data:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshMaterialsMutation]);

    const handleUploadConstructions = useCallback(async () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        fileInputRef.current?.click();
    }, []);

    const handleDownloadConstructions = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const response = await getWithAlert<any>(`assembly/get-assemblies-as-hbjson/${projectId}`, null);

            if (!response || !response.hb_constructions) {
                throw new Error('No data received from server');
            }

            let constructionsData;
            if (typeof response.hb_constructions === 'string') {
                constructionsData = JSON.parse(response.hb_constructions);
            } else {
                constructionsData = response.hb_constructions;
            }

            const jsonString = JSON.stringify(constructionsData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `project_${projectId}_assemblies.json`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download constructions:', error);
            alert(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsRefreshing(false);
        }
    }, [projectId]);

    const handleFileSelected = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            if (!(file.name.toLowerCase().endsWith('.hbjson') || file.name.toLowerCase().endsWith('.json'))) {
                alert('Please select a valid .hbjson or .json file');
                return;
            }

            try {
                setIsRefreshing(true);
                await uploadMutation.mutateAsync(file);
            } catch (error) {
                console.error('API error:', error);
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                setIsRefreshing(false);
            }
        },
        [uploadMutation]
    );

    const handleFlipOrientation = useCallback(
        async (assemblyId: number | null) => {
            if (!assemblyId) return;
            await flipOrientationMutation.mutateAsync(assemblyId);
            setSelectedAssemblyId(assemblyId);
            setRefreshKey(k => k + 1);
        },
        [flipOrientationMutation]
    );

    const handleFlipLayers = useCallback(
        async (assemblyId: number | null) => {
            if (!assemblyId) return;
            await flipLayersMutation.mutateAsync(assemblyId);
            setSelectedAssemblyId(assemblyId);
            setRefreshKey(k => k + 1);
        },
        [flipLayersMutation]
    );

    const handleDuplicateAssembly = useCallback(
        async (assemblyId: number | null) => {
            if (!assemblyId) return;
            try {
                setIsRefreshing(true);
                const response = await duplicateMutation.mutateAsync(assemblyId);
                if (response) {
                    setSelectedAssemblyId(response.id);
                }
            } finally {
                setIsRefreshing(false);
            }
        },
        [duplicateMutation]
    );

    const value = useMemo(
        () => ({
            fileInputRef,
            isRefreshing,
            refreshMessage,
            isLoadingAssemblies,
            assemblies,
            selectedAssemblyId,
            setSelectedAssemblyId,
            selectedAssembly,
            refreshKey,
            triggerRefresh,
            rValueRefreshKey,
            triggerRValueRefresh,
            handleAssemblyChange,
            handleAddAssembly,
            handleDeleteAssembly,
            handleNameChange,
            handleRefreshMaterials,
            handleUploadConstructions,
            handleDownloadConstructions,
            handleFileSelected,
            handleFlipOrientation,
            handleFlipLayers,
            handleDuplicateAssembly,
            layerThicknessOverridesMm,
            setLayerThicknessOverrideMm: setLayerThicknessOverride,
            clearLayerThicknessOverrides,
        }),
        [
            isRefreshing,
            refreshMessage,
            isLoadingAssemblies,
            assemblies,
            selectedAssemblyId,
            selectedAssembly,
            refreshKey,
            triggerRefresh,
            rValueRefreshKey,
            triggerRValueRefresh,
            handleAssemblyChange,
            handleAddAssembly,
            handleDeleteAssembly,
            handleNameChange,
            handleRefreshMaterials,
            handleUploadConstructions,
            handleDownloadConstructions,
            handleFileSelected,
            handleFlipOrientation,
            handleFlipLayers,
            handleDuplicateAssembly,
            layerThicknessOverridesMm,
            setLayerThicknessOverride,
            clearLayerThicknessOverrides,
        ]
    );

    return <AssemblyContext.Provider value={value}>{children}</AssemblyContext.Provider>;
};

export const useAssemblyContext = (): AssemblyContextType => {
    const context = useContext(AssemblyContext);
    if (!context) {
        throw new Error('useAssembly must be used within an AssemblyProvider');
    }
    return context;
};
