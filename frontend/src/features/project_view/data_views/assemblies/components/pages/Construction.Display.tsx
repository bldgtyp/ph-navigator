import { useParams } from "react-router-dom";
import ConstructionLayer from "./Construction.Layer"
import { Box } from "@mui/material";
import { useAssemblies } from "../../contexts/AssembliesContext";


const ConstructionDisplay: React.FC = () => {
    const { projectId } = useParams();
    const { isLoadingAssemblies, assemblies } = useAssemblies();

    return (
        <Box className="construction-layers" sx={{ margin: 4 }}>

            {isLoadingAssemblies && <p>Loading...</p>}
            {!isLoadingAssemblies && assemblies[0] && assemblies[0].layers.length === 0 && <p>No layers found.</p>}
            {!isLoadingAssemblies && assemblies[0] && assemblies[0].layers.length > 0 && (
                assemblies[0].layers.map((layer: any) => {
                    console.log("Layer: ", layer);
                    return <ConstructionLayer key={layer.id} layer={layer} />;
                })
            )}

        </Box>
    );
}

export default ConstructionDisplay;
