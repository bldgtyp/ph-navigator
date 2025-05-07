import { Stack } from "@mui/material";

type ContentBlockHeaderProps = {
    text: string; // Add a 'text' prop for the header content
};

const ContentBlockHeader: React.FC<ContentBlockHeaderProps> = ({ text }) => {
    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--appbar-bg-color').trim()
    const headerBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--outline-color').trim()

    return (
        <Stack
            className="content-block-heading"
            spacing={1}
            sx={{
                backgroundColor: headerBgColor,
                borderBottom: `1px solid ${headerBorderColor}`,
                padding: "16px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                textAlign: "left",
            }}
        >
            <h4>{text}</h4>
        </Stack>
    )
};

export default ContentBlockHeader;