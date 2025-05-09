import { useParams } from "react-router-dom";
import React from "react";
import { Box } from "@mui/material";

import LoadingModal from "../../../shared/components/LoadingModal";
import ContentBlockHeader from "../../../shared/components/ContentBlockHeader";
import ConstructionSelector from "./Construction.Selector";
import ConstructionDisplay from "./Construction.Display";
import { useMaterials } from "../../contexts/MaterialsContext";
import { useAssemblies } from "../../contexts/AssembliesContext";

// ----------------------------------------------------------------------------
const Constructions: React.FC = () => {
  // Load in the table data from the Database
  const { projectId } = useParams();
  const { isLoadingMaterials, materials } = useMaterials();
  const { isLoadingAssemblies, assemblies } = useAssemblies();

  // --------------------------------------------------------------------------
  // Render the component
  return (
    <>
      {" "}
      <LoadingModal showModal={isLoadingMaterials || isLoadingAssemblies} />
      <ContentBlockHeader text="Constructions" />
      <Box sx={{ margin: 2 }}>
        <ConstructionSelector />
        <ConstructionDisplay />
      </Box>
    </>
  );
}

export default Constructions;
