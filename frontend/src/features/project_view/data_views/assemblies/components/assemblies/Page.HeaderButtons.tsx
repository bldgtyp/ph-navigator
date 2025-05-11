import { Button } from "@mui/material";

interface HeaderButtonProps {
    key: string;
    text: string;
    handler: () => Promise<void>;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({ key, text, handler }) => {

    return (
        <Button
            key={key}
            className="header-button"
            variant="outlined"
            color="inherit"
            size="small"
            onClick={handler}
        >
            {text}
        </Button>
    )
}


export function headerButtons(
    handleAddAssembly: () => Promise<void>,
    handleDeleteAssembly: () => Promise<void>,
    handleRefreshMaterials: () => Promise<void>
): React.ReactElement[] {
    return [
        <HeaderButton key={"+"} text={"+ Add New Assembly"} handler={handleAddAssembly} />,
        <HeaderButton key={"-"} text={"Delete Assembly"} handler={handleDeleteAssembly} />,
        <HeaderButton key={"refresh"} text={"Refresh Materials"} handler={handleRefreshMaterials} />,
    ]
}