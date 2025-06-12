import { Box, Button, Modal } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import { useContext, useState } from "react";
import { MaterialSitePhotoType } from "../../types/Material.SitePhoto";
import { UserContext } from "../../../../../auth/contexts/UserContext";


interface FullImageModalType {
    selectedItem: MaterialSitePhotoType | null;
    setSelectedItem: (item: MaterialSitePhotoType | null) => void;
    onDeleteSitePhoto: (id: number) => Promise<void>;
}


const ImageFullViewModal = (props: FullImageModalType) => {
    const userContext = useContext(UserContext);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!props.selectedItem || !props.onDeleteSitePhoto) return;

        const confirmDelete = window.confirm("Are you sure you want to delete this image?");
        if (!confirmDelete) return;

        try {
            setIsDeleting(true);
            await props.onDeleteSitePhoto(props.selectedItem.id);
            props.setSelectedItem(null);
        } catch (error) {
            console.error("Error deleting image:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal
            open={!!props.selectedItem}
            onClose={() => props.setSelectedItem(null)}
        >
            <Box
                className="full-image-modal"
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: "background.paper",
                    p: 3,
                    borderRadius: 2,
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                }}
            >
                {props.selectedItem && (
                    <>
                        <Box sx={{ position: 'relative' }}>
                            <img
                                src={props.selectedItem.full_size_url}
                                alt="Enlarged material"
                                style={{
                                    maxWidth: "80vw",
                                    maxHeight: "70vh",
                                    borderRadius: 8,
                                    display: 'block'
                                }}
                            />
                        </Box>

                        {userContext.user && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Deleting..." : "Delete Image"}
                                </Button>
                            </Box>
                        )}
                    </>
                )}
            </Box>
        </Modal>
    )
}

export default ImageFullViewModal;
