import { Tooltip, Stack } from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";

/**
 * Renders a hover over Tooltip with a Comments Icon.
 * @param params - The parameters for the cell.
 */
export const TooltipWithComment: React.FC<{ row: { NOTES?: string } }> = ({ row }) => {
  if (row.NOTES) {
    return (
      <Tooltip title={row.NOTES}>
        <div className="checkbox-cell">
          <CommentIcon className="notes-icon" fontSize="medium" />
        </div>
      </Tooltip>
    );
  } else {
    return <div className="checkbox-cell"><div>-</div></div>;
  }
};
