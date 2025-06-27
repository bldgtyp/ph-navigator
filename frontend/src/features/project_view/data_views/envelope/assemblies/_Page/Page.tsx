import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Grid } from '@mui/material';

import { useMaterials } from '../../_contexts/MaterialsContext';
import { UserContext } from '../../../../../auth/_contexts/UserContext';

import { postWithAlert } from '../../../../../../api/postWithAlert';
import { getWithAlert } from '../../../../../../api/getWithAlert';
import { deleteWithAlert } from '../../../../../../api/deleteWithAlert';
import { patchWithAlert } from '../../../../../../api/patchWithAlert';

import LoadingModal from '../../../_components/LoadingModal';
import ContentBlockHeader from '../../../_components/ContentBlock.Header';
import { AssemblyType } from '../../_types/Assembly';
import AssemblyButtons from './Assembly.Buttons';
import { AssemblyView } from './Assembly.View';
import { fetchAndCacheMaterials } from '../../_contexts/MaterialsContext.Utility';
import { headerButtons } from './HeaderButtons';
import { postFileWithAlert } from '../../../../../../api/postFileWithAlert';
import ContentBlock from '../../../_components/ContentBlock';
import AssemblySidebar from './Assembly.Sidebar';

const AssembliesPage: React.FC = () => {
    const userContext = useContext(UserContext);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { projectId } = useParams();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const { isLoadingMaterials, setMaterials } = useMaterials();
    const [isLoadingAssemblies, setIsLoadingAssemblies] = useState<boolean>(true);
    const [assemblies, setAssemblies] = useState<AssemblyType[]>([]);
    const [selectedAssemblyId, setSelectedAssemblyId] = useState<number | null>(null);

    const fetchAssemblies = async () => {
        console.log('fetchAssemblies', projectId);
        try {
            const response = await getWithAlert<AssemblyType[]>(`assembly/get-assemblies/${projectId}`);
            setAssemblies(response ?? []);
            return response ?? [];
        } catch (error) {
            console.error('Failed to fetch assemblies:', error);
            return [];
        } finally {
            setIsLoadingAssemblies(false);
        }
    };

    useEffect(() => {
        const initializeAssemblies = async () => {
            const fetchedAssemblies = await fetchAssemblies();
            if (fetchedAssemblies.length > 0) {
                setSelectedAssemblyId(fetchedAssemblies[0].id); // Set the first assembly as selected
            } else {
                setSelectedAssemblyId(null); // No assemblies available
            }
        };

        initializeAssemblies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const selectedAssembly = useMemo(() => {
        return assemblies.find(assembly => assembly.id === selectedAssemblyId) || null;
    }, [assemblies, selectedAssemblyId]);

    const handleAssemblyChange = async (assemblyId: number) => {
        console.log('handleAssemblyChange', assemblyId);
        setSelectedAssemblyId(assemblyId);
        await fetchAssemblies();
    };

    const handleAddAssembly = async () => {
        console.log('handleAddAssembly');
        try {
            const response = await postWithAlert<AssemblyType>(`assembly/create-new-assembly-on-project/${projectId}`);

            if (response) {
                const newAssembly = response;
                console.log(`Assembly added successfully: ${newAssembly.id}`);
                const updatedAssemblies = await fetchAssemblies();
                setSelectedAssemblyId(newAssembly.id);
            }
        } catch (error) {
            console.error('Failed to add assembly:', error);
        }
    };

    const handleDeleteAssembly = async (assemblyId: number) => {
        console.log(`handleDeleteAssembly(${assemblyId})`);

        try {
            const confirmed = window.confirm('Are you sure you want to delete the Assembly?');
            if (!confirmed) return;

            await deleteWithAlert(`assembly/delete-assembly/${assemblyId}`, null, {});

            console.log(`Assembly ${assemblyId} deleted successfully.`);

            // Fetch updated assemblies and update the state
            const updatedAssemblies = await fetchAssemblies();

            // Select the first assembly in the updated list, or set to null if none remain
            if (updatedAssemblies.length > 0) {
                setSelectedAssemblyId(updatedAssemblies[0].id);
            } else {
                setSelectedAssemblyId(null);
            }
        } catch (error) {
            console.error(`Failed to delete Assembly ${assemblyId}:`, error);
        }
    };

    const handleNameChange = async (assemblyId: number, newName: string) => {
        console.log('handleNameChange', assemblyId, newName);
        try {
            await patchWithAlert(`assembly/update-assembly-name/${assemblyId}`, null, {
                new_name: newName,
            });

            // Update the assemblies state
            const updatedAssemblies = assemblies.map(assembly =>
                assembly.id === assemblyId ? { ...assembly, name: newName } : assembly
            );
            setAssemblies(updatedAssemblies);

            // Ensure the selected assembly is updated
            handleAssemblyChange(assemblyId);
        } catch (error) {
            console.error('Failed to update assembly name:', error);
        }
    };

    const handleRefreshMaterials = async () => {
        console.log('handleRefreshMaterials');
        setIsRefreshing(true);
        setRefreshMessage(null);
        try {
            await getWithAlert('assembly/refresh-db-materials-from-air-table');
            const fetchedMaterials = await fetchAndCacheMaterials();
            setMaterials(fetchedMaterials);
            setRefreshMessage('Materials refreshed successfully!');
        } catch (error) {
            setRefreshMessage('Error loading Material Data. Please try again later.');
            console.error('Error loading Material Data:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleUploadConstructions = async () => {
        console.log('handleUploadConstructions');
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset before opening to ensure onChange fires
        }
        fileInputRef.current?.click();
    };

    const handleDownloadConstructions = async () => {
        console.log('handleDownloadConstructions');
        try {
            setIsRefreshing(true); // Show loading state

            // Download the HBJSON data
            console.log(`Downloading Construction HBJSON for project: ${projectId}`);
            const response = await getWithAlert<any>(`assembly/get-assemblies-as-hbjson/${projectId}`, null);

            if (!response || !response.hb_constructions) {
                throw new Error('No data received from server');
            }

            // Parse the string if it's returned as a string
            let constructionsData;
            if (typeof response.hb_constructions === 'string') {
                // If the API returns a JSON string, parse it to an object
                constructionsData = JSON.parse(response.hb_constructions);
            } else {
                // If it's already an object, use it directly
                constructionsData = response.hb_constructions;
            }

            // Create a JSON string with proper formatting
            const jsonString = JSON.stringify(constructionsData, null, 2);

            // Create a Blob from the JSON string
            const blob = new Blob([jsonString], { type: 'application/json' });

            // Create a URL for the Blob
            const url = URL.createObjectURL(blob);

            // Create a temporary anchor element to trigger the download
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `project_${projectId}_assemblies.json`; // File name

            // Trigger the download
            document.body.appendChild(downloadLink);
            downloadLink.click();

            // Clean up
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download constructions:', error);
            alert(`Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsRefreshing(false); // Hide loading state
        }
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('handleFileSelected');
        const file = event.target.files?.[0];
        if (!file) return;
        console.log('Selected file:', file);
        // Validate file extension
        if (!(file.name.toLowerCase().endsWith('.hbjson') || file.name.toLowerCase().endsWith('.json'))) {
            alert('Please select a valid .hbjson or .json file');
            return;
        }

        try {
            // Show loading state
            setIsRefreshing(true);

            // Upload the file
            console.log('Uploading file...');
            const response = await postFileWithAlert<any>(
                `assembly/add-assemblies-from-hbjson-constructions/${projectId}`,
                null,
                file
            );
        } catch (error) {
            console.error('API error:', error);
            throw error;
        } finally {
            // Refresh Assemblies to show the newly added ones
            await fetchAssemblies();

            // Reset the file input so the same file can be selected again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Hide loading state
            setIsRefreshing(false);
        }
    };

    const handleFlipOrientation = async (assemblyId: number) => {
        console.log('handleFlipOrientation', assemblyId);
        try {
            const updatedAssembly = await patchWithAlert<AssemblyType>(
                `assembly/flip-assembly-orientation/${assemblyId}`,
                null,
                {}
            );

            if (!updatedAssembly) {
                console.error('Failed to flip assembly orientation: No data returned');
                return;
            }

            // Update the assemblies state
            const updatedAssemblies = assemblies.map(assembly =>
                assembly.id === assemblyId ? { ...updatedAssembly } : assembly
            );
            setAssemblies(updatedAssemblies);

            // Ensure the selected assembly is updated
            handleAssemblyChange(assemblyId);
        } catch (error) {
            console.error('Failed to update assembly name:', error);
        }
    };

    const handleFlipLayers = async (assemblyId: number) => {
        console.log('handleFlipLayers', assemblyId);
        try {
            const updatedAssembly = await patchWithAlert<AssemblyType>(
                `assembly/flip-assembly-layers/${assemblyId}`,
                null,
                {}
            );

            if (!updatedAssembly) {
                console.error('Failed to flip assembly layers: No data returned');
                return;
            }

            // Update the assemblies state
            const updatedAssemblies = assemblies.map(assembly =>
                assembly.id === assemblyId ? { ...updatedAssembly } : assembly
            );
            setAssemblies(updatedAssemblies);

            // Ensure the selected assembly is updated
            handleAssemblyChange(assemblyId);
        } catch (error) {
            console.error('Failed to update assembly layers:', error);
        }
    };

    const handleDuplicateAssembly = async (assemblyId: number) => {
        console.log(`handleDuplicateAssembly(${assemblyId})`);

        try {
            setIsRefreshing(true);
            const response = await postWithAlert<AssemblyType>(`assembly/duplicate-assembly/${assemblyId}`);
            if (response) {
                setSelectedAssemblyId(response.id);
            }
        } catch (error) {
            console.error('Error:', error);
            throw error;
        } finally {
            await fetchAssemblies();
            setIsRefreshing(false);
        }
    };

    return (
        <ContentBlock>
            <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />

            <ContentBlockHeader
                text={`Assembly Details [ ${selectedAssembly?.name || ''} ]`}
                buttons={
                    userContext.user
                        ? headerButtons(
                              handleRefreshMaterials,
                              handleUploadConstructions,
                              handleDownloadConstructions,
                              isRefreshing
                          )
                        : []
                }
            />

            <Grid container spacing={1} sx={{ margin: 2 }}>
                <Grid size={2}>
                    <AssemblySidebar
                        assemblies={assemblies}
                        selectedAssemblyId={selectedAssemblyId}
                        onAssemblyChange={handleAssemblyChange}
                        onAddAssembly={handleAddAssembly}
                        onDeleteAssembly={handleDeleteAssembly}
                        onNameChange={handleNameChange}
                    />
                </Grid>
                <Grid size={10} sx={{ borderLeft: '1px solid #ccc' }}>
                    <AssemblyButtons
                        selectedAssemblyId={selectedAssemblyId}
                        onFlipOrientation={handleFlipOrientation}
                        onFlipLayers={handleFlipLayers}
                        onDuplicateAssembly={handleDuplicateAssembly}
                    />
                    {isLoadingAssemblies && <p>Loading...</p>}
                    {!isLoadingAssemblies && selectedAssembly === null && <p>No assemblies available.</p>}
                    {!isLoadingAssemblies && selectedAssembly && selectedAssembly.layers.length === 0 && (
                        <p>No layers found.</p>
                    )}
                    {!isLoadingAssemblies && selectedAssembly && selectedAssembly.layers.length > 0 && (
                        <AssemblyView assembly={selectedAssembly} />
                    )}
                </Grid>
            </Grid>

            {/* File Upload Dialog */}
            <input
                type="file"
                accept=".hbjson, .json"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelected}
            />
        </ContentBlock>
    );
};

export default AssembliesPage;
