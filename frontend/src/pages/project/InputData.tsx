import Page from "./Page";
import { Stack } from "@mui/material";
import ContentBlock from "../../components/layout/ContentBlock";
import FanDataGrid from "../../components/tables/FanDataGrid";


export default function ProjectData(params: any) {
    return (
        <Page>
            <ContentBlock>
                <FanDataGrid />
            </ContentBlock>
        </Page>
    )
}