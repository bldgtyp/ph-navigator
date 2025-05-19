import { Box, Modal } from "@mui/material";

type T = {
    full_size_url: string;
    thumbnail_url: string;
}

interface FullImageModalType<T extends { full_size_url: string }> {
    selectedItem: T | null;
    setSelectedItem: (item: T | null) => void;
}


const ImageFullViewModal = <T extends { full_size_url: string }>(props: FullImageModalType<T>) => {
    return (
        <Modal open={!!props.selectedItem} onClose={() => props.setSelectedItem(null)}>
            <Box
                className="full-image-modal"
                sx={{ bgcolor: "background.paper", p: 2 }}>
                {props.selectedItem && (
                    <img
                        src={props.selectedItem.full_size_url}
                        alt="Enlarged"
                        style={{ maxWidth: "80vw", maxHeight: "80vh", borderRadius: 8 }}
                    />
                )}
            </Box>
        </Modal>
    )
}

export default ImageFullViewModal;
