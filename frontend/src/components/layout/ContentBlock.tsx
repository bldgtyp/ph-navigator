import { Paper } from "@mui/material";
import "../../styles/ContentBlock.css";

function ContentBlock(props: any) {
  return (
    <Paper elevation={5} className="content-block">
      {props.children}
    </Paper>
  );
}

export default ContentBlock;
