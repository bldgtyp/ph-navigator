import React from 'react';
import ContentBlockHeader from '../../_components/ContentBlock.Header';
import ContentBlock from '../../_components/ContentBlock';
import BlowerDoorTesting from './_components/BlowerDoorTest';
import BuildingData from './_components/BuildingData';

const AirtightnessPage: React.FC = () => {
    return (
        <>
            {/* Building Data for Testing */}
            <ContentBlock>
                <ContentBlockHeader text="Building Data:" />
                <BuildingData />
            </ContentBlock>

            {/* Testing Information */}
            <ContentBlock>
                <ContentBlockHeader text="Blower-Door Testing:" />
                <BlowerDoorTesting />
            </ContentBlock>
        </>
    );
};

export default AirtightnessPage;
