import { useState } from "react";
import { CardActionArea, CardContent, Typography } from "@mui/material";

import { postWithAlert } from "../../../api/postWithAlert";
import CardContainer from "./Card.Container";
import ModalCreateNewProject from "./Modal.CreateNewProject";

interface formDataType {
    name: string;
    bt_number: string;
    phius_number: string | null;
    phius_dropbox_url: string | null;
}


interface CreateNewProjectCardType {
    setProjectCardData: React.Dispatch<React.SetStateAction<any[]>>;
}

const CreateNewProjectCard: React.FC<CreateNewProjectCardType> = (props) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleOnClick = () => { setIsModalOpen(true); }
    const handleModalClose = () => { setIsModalOpen(false); }
    const handleSubmit = async (formData: formDataType) => {
        try {
            const response = await postWithAlert<any>('project/create_new_project', null, formData)

            if (response) {
                //Add the new Project to the local state
                props.setProjectCardData((prev) => {
                    const newProject = {
                        id: response.id,
                        name: formData.name,
                        bt_number: formData.bt_number,
                        phius_number: formData.phius_number,
                    };
                    return [...prev, newProject];
                });
            }
        } catch (error) {
            console.error("Failed to create new project:", error);
        }
        setIsModalOpen(false);
    };

    return (
        <CardContainer>
            <CardActionArea onClick={handleOnClick} sx={{ cursor: "pointer" }}>
                <CardContent sx={{ alignItems: "center", justifyContent: "center", display: "flex", flexDirection: "column" }}>
                    <Typography color="primary" variant="h5" component="div">
                        Add a New Project...
                    </Typography>
                </CardContent>
            </CardActionArea>

            {/* Modal Dialog for Creating a New Project */}
            <ModalCreateNewProject
                isModalOpen={isModalOpen}
                handleModalClose={handleModalClose}
                handleSubmit={handleSubmit}
            />
        </CardContainer>
    );
}

export default CreateNewProjectCard;