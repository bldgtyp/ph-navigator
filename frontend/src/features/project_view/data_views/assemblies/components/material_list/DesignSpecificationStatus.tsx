import React, { useContext, useState } from "react";
import { Box, Select, MenuItem, SelectChangeEvent, Typography } from "@mui/material";

import { patchWithAlert } from "../../../../../../api/patchWithAlert";

import { SegmentType, SpecificationStatus } from "../../types/Segment";
import { UserContext } from "../../../../../auth/contexts/UserContext";


const getDesignSpecificationText = (value: SpecificationStatus) => {
    switch (value) {
        case SpecificationStatus.COMPLETE:
            return "Design Spec.Complete";
        case SpecificationStatus.QUESTION:
            return "Design Spec. Question";
        case SpecificationStatus.MISSING:
            return "Design Spec. Missing";
        case SpecificationStatus.NA:
            return "N/A";
        default:
            return "N/A";
    }
}


const DesignSpecificationStatus: React.FC<{ segment: SegmentType }> = (props) => {
    const userContext = useContext(UserContext);
    const [status, setStatus] = useState<SpecificationStatus>(props.segment.specification_status);

    const handleChange = async (event: SelectChangeEvent<SpecificationStatus>) => {
        const newStatus = event.target.value as SpecificationStatus;
        setStatus(newStatus);

        try {
            await patchWithAlert(
                `assembly/update-segment-specification-status/${props.segment.id}`,
                null,
                { specification_status: newStatus }
            );
        } catch (error) {
            setStatus(props.segment.specification_status);
            alert("Failed to update status.");
        }
    };

    return (
        <Box sx={{ flex: 1, alignItems: "left", display: "flex", flexDirection: "column" }}>
            <Select
                className={`row-item specification-dropdown have-specification-${status}`}
                value={status}
                onChange={handleChange}
                size="small"
                sx={{ minWidth: 200, fontSize: "0.7rem" }}
                disabled={!userContext.user}
            >
                {Object.values(SpecificationStatus).map((value) => (
                    <MenuItem
                        key={value}
                        value={value}
                    >
                        {getDesignSpecificationText(value)}
                    </MenuItem>
                ))}
            </Select>
        </Box>
    );
};

export default DesignSpecificationStatus;