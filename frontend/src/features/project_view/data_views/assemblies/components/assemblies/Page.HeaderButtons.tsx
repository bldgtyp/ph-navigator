import { Button } from "@mui/material";

interface HeaderButtonProps {
    text: string;
    handler: () => Promise<void>;
    loading?: boolean;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ text, handler, loading }) => {

    return (
        <Button
            className="header-button"
            variant="outlined"
            color="inherit"
            size="small"
            onClick={handler}
            disabled={loading}
        >
            {loading ? "Loading...." : text}
        </Button>
    )
}


export function headerButtons(
    handleAddAssembly: () => Promise<void>,
    handleDeleteAssembly: () => Promise<void>,
    handleRefreshMaterials: () => Promise<void>,
    loading: boolean = false,
): React.ReactElement[] {
    return [
        <HeaderButton key={"+"} text={"+ Add New Assembly"} handler={handleAddAssembly} loading={false} />,
        <HeaderButton key={"-"} text={"Delete Assembly"} handler={handleDeleteAssembly} loading={false} />,
        <HeaderButton key={"refresh"} text={"Refresh Materials"} handler={handleRefreshMaterials} loading={loading} />,
    ]
}