import { Paper } from "@mui/material";
import { Project } from "../types/database/Project";

function ProjectCard(props: Project) {
    return (
        <Paper>
            <p>ID: {props.id}</p>
            <p>Project: {props.name}</p>
            <p>BT Number: {props.bt_number}</p>
            <p>PHIUS Number: {props.phius_number}</p>
            <a href={props.airtable_base_url}>Airtable Base: {props.airtable_base_url}</a>
        </Paper>
    );
}

export default ProjectCard;