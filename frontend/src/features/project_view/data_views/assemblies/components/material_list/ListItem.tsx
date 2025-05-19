import React, { useContext } from "react";
import { Box, Stack, Tooltip } from "@mui/material";
import SpeakerNotesTwoToneIcon from '@mui/icons-material/SpeakerNotesTwoTone';

import { UserContext } from "../../../../../auth/contexts/UserContext";

import { SegmentType } from "../../types/Segment";
import SegmentSitePhotos from "./Segment.SitePhotos";
import SegmentDatasheets from "./Segment.Datasheets";
import DesignSpecificationStatus from "./DesignSpecificationStatus";
import DetailsModal from "./Details.Modal";
import { useMaterialListItemHooks } from "./ListItem.Hooks";

interface MaterialListItemNameProps {
    name: string;
    notes: string;
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const MaterialListItemName: React.FC<MaterialListItemNameProps> = (props) => {

    return (
        <Tooltip title={props.notes} placement="top" arrow>
            <Box
                onClick={props.onClick}
                className="row-item material-name"
                sx={{ flex: 1 }}>
                {props.name}{props.notes ? (
                    <SpeakerNotesTwoToneIcon
                        sx={{
                            fontSize: 18,
                            marginLeft: 1,
                            color: "var(--question-stroke)",
                        }}
                    />
                ) : null}
            </Box>
        </Tooltip>
    );
}

const MaterialListItem: React.FC<{ segment: SegmentType }> = (props) => {
    const userContext = useContext(UserContext);
    const hooks = useMaterialListItemHooks(props.segment);

    return (
        userContext.user || props.segment.specification_status !== "na" ? (
            <Stack
                className="material-row"
                direction="row"
                spacing={2}
                sx={{
                    padding: 1,
                    bgcolor: hooks.isSegmentHovered ? "var(--appbar-bg-color)" : "transparent",
                    cursor: "pointer",
                }}
                onMouseEnter={hooks.handleMouseEnter}
                onMouseLeave={hooks.handleMouseLeave}
            >
                <MaterialListItemName name={props.segment.material.name} notes={hooks.currentNotes} onClick={hooks.handleMouseClick} />
                <DesignSpecificationStatus segment={props.segment} />
                <SegmentDatasheets segment={props.segment} materialName={props.segment.material.name} />
                <SegmentSitePhotos segment={props.segment} materialName={props.segment.material.name} />
                <DetailsModal
                    isModalOpen={hooks.isModalOpen}
                    handleModalClose={hooks.handleModalClose}
                    handleSubmit={hooks.handleSubmit}
                    handleNotesChange={hooks.handleNotesChange}
                    segment={props.segment}
                    currentNotes={hooks.currentNotes}
                />
            </Stack>
        ) : null
    );
}

export default MaterialListItem;