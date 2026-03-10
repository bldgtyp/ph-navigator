import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { fetchPost, fetchDelete, fetchPatch, fetchPostFile, fetchGet } from '../../../../../../api/fetchApi';
import { queryKeys } from '../../../../../../api/queryKeys';
import { AssemblyType } from '../../_types/Assembly';

export function useAddAssemblyMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => fetchPost<AssemblyType>(`assembly/create-new-assembly-on-project/${projectId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useDeleteAssemblyMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (assemblyId: number) => fetchDelete(`assembly/delete-assembly/${assemblyId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useRenameAssemblyMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ assemblyId, newName }: { assemblyId: number; newName: string }) =>
            fetchPatch(`assembly/update-assembly-name/${assemblyId}`, { new_name: newName }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useFlipOrientationMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (assemblyId: number) =>
            fetchPatch<AssemblyType>(`assembly/flip-assembly-orientation/${assemblyId}`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useFlipLayersMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (assemblyId: number) => fetchPatch<AssemblyType>(`assembly/flip-assembly-layers/${assemblyId}`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useDuplicateAssemblyMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (assemblyId: number) => fetchPost<AssemblyType>(`assembly/duplicate-assembly/${assemblyId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useUploadConstructionsMutation() {
    const { projectId } = useParams();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (file: File) =>
            fetchPostFile(`assembly/add-assemblies-from-hbjson-constructions/${projectId}`, file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.assemblies(projectId || '') });
        },
    });
}

export function useRefreshAssemblyMaterialsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => fetchGet('assembly/refresh-db-materials-from-air-table'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials() });
        },
    });
}
