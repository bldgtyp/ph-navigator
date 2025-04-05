import { Box } from "@mui/material";

const DataViewPage: React.FC<any> = (props) => {
  return <Box className="page">{props.children}</Box>;
}

export default DataViewPage;
