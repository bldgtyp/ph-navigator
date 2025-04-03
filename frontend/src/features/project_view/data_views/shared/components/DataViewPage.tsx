import { Box } from "@mui/material";
import "../../../../../styles/Page.css";

function DataViewPage(props: any) {
  return <Box className="page">{props.children}</Box>;
}

export default DataViewPage;
