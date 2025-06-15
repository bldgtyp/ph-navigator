import { Box } from "@mui/material";

const ContentBlock: React.FC<any> = (props) => {
  return (
    <Box
      className="content-block"
      sx={{
        outline: "1px solid #E0E0E0",
        borderRadius: "8px",
        padding: "0px",
        marginLeft: "6%",
        marginRight: "6%",
        marginTop: "35px",
        marginBottom: "35px",
        overflow: "hidden",
      }}
    >
      {props.children}
    </Box>
  );
}

export default ContentBlock;
