import { useParams } from "react-router-dom";

// ----------------------------------------------------------------------------
const ConstructionSelector: React.FC = () => {
    const { projectId } = useParams();

    return (
        <div className='construction-selector'>
            Construction Selector...
        </div>
    );
}

export default ConstructionSelector;
