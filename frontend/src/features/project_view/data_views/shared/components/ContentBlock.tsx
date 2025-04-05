import { Paper } from "@mui/material";
import "../../styles/ContentBlock.css";

const ContentBlock: React.FC<any> = (props) => {
  return (
    <Paper elevation={5} className="content-block">
      {props.children}
    </Paper>
  );
}

export default ContentBlock;
