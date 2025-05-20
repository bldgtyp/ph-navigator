import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import { useParams } from "react-router-dom";
import { Box, SelectChangeEvent } from "@mui/material";

import { useMaterials } from "../../contexts/MaterialsContext";
import { UserContext } from "../../../../../auth/contexts/UserContext";

import { postWithAlert } from "../../../../../../api/postWithAlert";
import { getWithAlert } from "../../../../../../api/getWithAlert";
import { deleteWithAlert } from "../../../../../../api/deleteWithAlert";
import { patchWithAlert } from "../../../../../../api/patchWithAlert";

import LoadingModal from "../../../shared/components/LoadingModal";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import { AssemblyType } from "../../types/Assembly";
import { AssemblySelector } from "./Page.Selector";
import { AssemblyView } from "./Page.AssemblyView";
import { fetchAndCacheMaterials } from "../../contexts/MaterialsContext.Utility";
import { headerButtons } from "./Page.HeaderButtons";
import { postFileWithAlert } from "../../../../../../api/postFileWithAlert";

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
    try {
      const response = await getWithAlert<AssemblyType[]>(`assembly/get_assemblies/${projectId}`);
      setAssemblies(response ?? []);
      return response ?? [];
    } catch (error) {
      console.error("Failed to fetch assemblies:", error);
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
    return assemblies.find((assembly) => assembly.id === selectedAssemblyId) || null;
  }, [assemblies, selectedAssemblyId]);

  const handleAssemblyChange = async (event: SelectChangeEvent<number>) => {
    const newSelectedAssemblyId = event.target.value as number;
    setSelectedAssemblyId(newSelectedAssemblyId);
    await fetchAssemblies();
  };

  const handleAddAssembly = async () => {
    try {
      const response = await postWithAlert<{ message: string; assembly: AssemblyType }>(
        `assembly/add_assembly/`,
        null,
        {
          bt_number: projectId,
        }
      );

      if (response) {
        const newAssembly = response.assembly;
        console.log(`Assembly added successfully: ${newAssembly.id}`);
        const updatedAssemblies = await fetchAssemblies();
        setSelectedAssemblyId(newAssembly.id);
      }
    } catch (error) {
      console.error("Failed to add assembly:", error);
    }
  };

  const handleDeleteAssembly = async () => {
    if (!selectedAssemblyId) {
      console.error("No assembly selected to delete.");
      return;
    }

    try {
      const confirmed = window.confirm("Are you sure you want to delete this assembly?");
      if (!confirmed) return;

      await deleteWithAlert(
        `assembly/delete_assembly`,
        null,
        {
          assembly_id: selectedAssemblyId,
        }
      );

      console.log(`Assembly ${selectedAssemblyId} deleted successfully.`);

      // Fetch updated assemblies and update the state
      const updatedAssemblies = await fetchAssemblies();

      // Select the first assembly in the updated list, or set to null if none remain
      if (updatedAssemblies.length > 0) {
        setSelectedAssemblyId(updatedAssemblies[0].id);
      } else {
        setSelectedAssemblyId(null);
      }
    } catch (error) {
      console.error("Failed to delete assembly:", error);
    }
  };

  const handleNameChange = async (assemblyId: number, newName: string) => {
    try {
      await patchWithAlert(
        `assembly/update_assembly_name`,
        null,
        {
          assembly_id: assemblyId,
          new_name: newName,
        }
      );

      // Update the assemblies state
      const updatedAssemblies = assemblies.map((assembly) =>
        assembly.id === assemblyId ? { ...assembly, name: newName } : assembly
      );
      setAssemblies(updatedAssemblies);

      // Ensure the selected assembly is updated
      handleAssemblyChange({
        target: {
          value: assemblyId,
        },
      } as SelectChangeEvent<number>);
    } catch (error) {
      console.error("Failed to update assembly name:", error);
    }
  };

  const handleRefreshMaterials = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await getWithAlert('assembly/refresh_db_materials_from_air_table');
      const fetchedMaterials = await fetchAndCacheMaterials();
      setMaterials(fetchedMaterials);
      setRefreshMessage("Materials refreshed successfully!");
    } catch (error) {
      setRefreshMessage("Error loading Material Data. Please try again later.");
      console.error("Error loading Material Data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUploadConstructions = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset before opening to ensure onChange fires
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("handleFileSelected");
    const file = event.target.files?.[0];
    if (!file) return;
    console.log("Selected file:", file);
    // Validate file extension
    if (
      !(
        file.name.toLowerCase().endsWith('.hbjson') ||
        file.name.toLowerCase().endsWith('.json')
      )
    ) {
      alert("Please select a valid .hbjson or .json file");
      return;
    }

    try {
      // Show loading state
      setIsRefreshing(true);

      // Upload the file
      console.log("Uploading file...");
      const response = await postFileWithAlert<any>(
        `assembly/add-assemblies-from-hbjson-constructions/${projectId}`,
        null,
        file
      );

      // Refresh assemblies to show the newly added ones
      await fetchAssemblies();
      alert("Constructions uploaded successfully!");
    } catch (error) {
      console.error("Failed to upload constructions:", error);
      alert(`Failed to upload: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsRefreshing(false);
      // Reset the file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />

      <ContentBlockHeader
        text={`Assembly Details [ ${selectedAssembly?.name || ""} ]`}
        buttons={userContext.user ? headerButtons(
          handleAddAssembly,
          handleDeleteAssembly,
          handleRefreshMaterials,
          handleUploadConstructions,
          isRefreshing) : []}
      />

      <Box sx={{ margin: 2 }}>
        <AssemblySelector
          assemblies={assemblies}
          selectedAssemblyId={selectedAssemblyId}
          handleAssemblyChange={handleAssemblyChange}
          handleNameChange={handleNameChange}
        />
        {isLoadingAssemblies && <p>Loading...</p>}
        {!isLoadingAssemblies && selectedAssembly === null && <p>No assemblies available.</p>}
        {!isLoadingAssemblies && selectedAssembly && selectedAssembly.layers.length === 0 && (
          <p>No layers found.</p>
        )}
        {!isLoadingAssemblies && selectedAssembly && selectedAssembly.layers.length > 0 && (
          <AssemblyView assembly={selectedAssembly} />
        )}
      </Box>

      {/* File Upload Dialog */}
      <input
        type="file"
        accept=".hbjson, .json"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
    </>
  );
};

export default AssembliesPage;
