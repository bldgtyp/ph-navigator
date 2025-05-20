import { Button, Tooltip } from "@mui/material";
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';

type HeaderButtonId = "+" | "-" | "refresh" | "upload";

interface HeaderButtonProps {
    id: HeaderButtonId;
    text: string;
    icon?: React.ReactNode | null;
    handler: () => Promise<void>;
    loading?: boolean;
}

const hoverText = {
    "+": "Add a new Assembly.",
    "-": "Delete the current Assembly.",
    "refresh": "Reload the materials from the AirTable database.",
    "upload": "Upload an HBJSON file containing one or more HB-Constructions. These will be added to the set of assemblies and will OVERWRITE any existing Assemblies with the same name.",
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ id, text, icon, handler, loading }) => {

    return (
        <Tooltip title={hoverText[id]} placement="top" arrow>
            <Button
                className="header-button"
                variant="outlined"
                color="inherit"
                size="small"
                onClick={handler}
                disabled={loading}
                startIcon={icon}
            >
                {loading ? "Loading...." : text}
            </Button>
        </Tooltip>
    )
}


export function headerButtons(
    handleAddAssembly: () => Promise<void>,
    handleDeleteAssembly: () => Promise<void>,
    handleRefreshMaterials: () => Promise<void>,
    handleUploadConstructions: () => Promise<void>,
    loading: boolean = false,
): React.ReactElement[] {


    return [
        <HeaderButton
            key={"+"}
            id={"+"}
            text={"+ Add New Assembly"}
            handler={handleAddAssembly}
            loading={loading}
        />,
        <HeaderButton
            key={"-"}
            id={"-"}
            text={"Delete Assembly"}
            icon={<DeleteForeverRoundedIcon />}
            handler={handleDeleteAssembly}
            loading={loading}
        />,
        <HeaderButton
            key={"refresh"}
            id={"refresh"}
            text={"Refresh Materials"}
            icon={<RefreshRoundedIcon />}
            handler={handleRefreshMaterials}
            loading={loading}
        />,
        <HeaderButton
            key={"upload"}
            id={"upload"}
            text={"Upload HBJSON"}
            icon={<FileUploadOutlinedIcon />}
            handler={handleUploadConstructions}
            loading={loading}
        />,
    ]
}