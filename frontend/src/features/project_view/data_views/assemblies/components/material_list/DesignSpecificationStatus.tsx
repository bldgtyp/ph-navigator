import React, { useState } from "react";
import { Box, Select, MenuItem, SelectChangeEvent, Typography } from "@mui/material";

import { patchWithAlert } from "../../../../../../api/patchWithAlert";

import { SegmentType, SpecificationStatus } from "../../types/Segment";


const DesignSpecificationStatus: React.FC<{ segment: SegmentType }> = (props) => {
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
            <Typography variant="caption">Have Design Specification?</Typography>
            <Select
                className={`row-item have-specification-${status}`}
                value={status}
                onChange={handleChange}
                size="small"
                sx={{ minWidth: 150, fontSize: "0.8rem" }}
            >
                {Object.values(SpecificationStatus).map((value) => (
                    <MenuItem key={value} value={value}>
                        {value.charAt(0).toUpperCase() + value.slice(1)}
                    </MenuItem>
                ))}
            </Select>
        </Box>
    );
};

export default DesignSpecificationStatus;