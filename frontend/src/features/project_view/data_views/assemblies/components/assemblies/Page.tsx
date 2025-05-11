import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Button, SelectChangeEvent } from "@mui/material";

import { useMaterials } from "../../contexts/MaterialsContext";

import { postWithAlert } from "../../../../../../api/postWithAlert";
import { getWithAlert } from "../../../../../../api/getWithAlert";

import LoadingModal from "../../../shared/components/LoadingModal";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import { AssemblyType } from "../../types/Assembly";
import { AssemblySelector } from "./Page.Selector";
import { AssemblyView } from "./Page.AssemblyView";
import { deleteWithAlert } from "../../../../../../api/deleteWithAlert";


const AssembliesPage: React.FC = () => {
  const { projectId } = useParams();
  const { isLoadingMaterials } = useMaterials();
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
          project_bt_num: projectId,
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

  const headerButtons = [
    <Button
      key="+"
      className="header-button"
      variant="outlined"
      color="inherit"
      size="small"
      onClick={handleAddAssembly}
    >
      + Add New Assembly
    </Button>,
    <Button
      key="-"
      className="header-button"
      variant="outlined"
      color="inherit"
      size="small"
      onClick={handleDeleteAssembly}
    >
      Delete Assembly
    </Button>,
  ];

  return (
    <>
      <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />
      <ContentBlockHeader text="Constructions" buttons={headerButtons} />
      <Box sx={{ margin: 2 }}>
        <AssemblySelector
          assemblies={assemblies}
          selectedAssemblyId={selectedAssemblyId}
          handleAssemblyChange={handleAssemblyChange}
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
    </>
  );
};

export default AssembliesPage;
