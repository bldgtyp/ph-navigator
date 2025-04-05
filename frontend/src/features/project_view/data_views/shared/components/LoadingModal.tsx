import { Box, Modal } from "@mui/material";
import "../../../../../styles/Modal.css";

type propsType = {
  showModal?: boolean;
}

/**
 * Renders a loading modal-window component.
 *
 * @param {Object} props - The component props.
 * @param {boolean} props.showModal - Determines whether to show the modal or not.
 * @returns {JSX.Element} The loading modal component.
 */
const LoadingModal: React.FC<propsType> = ({ showModal }) => {
  return showModal ? (
    <Modal open={showModal}>
      <Box className="modal-box-loading">Loading Project Data...</Box>
    </Modal>
  ) : (
    <></>
  );
}

export default LoadingModal;
