import { Paper } from "@mui/material";

const ContentBlock: React.FC<any> = (props) => {
  return (
    <Paper
      elevation={0}
      className="content-block"
      sx={{
        outline: "1px solid #E0E0E0",
        borderRadius: "8px",
        padding: "0px",
        marginLeft: "7%",
        marginRight: "7%",
        marginTop: "35px"
      }}
    >
      {props.children}
    </Paper>
  );
}

export default ContentBlock;
