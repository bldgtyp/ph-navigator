import React from 'react';
import { useParams } from 'react-router-dom';
import ContentBlockHeader from '../../_components/ContentBlock.Header';
import ContentBlock from '../../_components/ContentBlock';
import RequiredSitePhotosGrid from '../../_components/RequiredSitePhoto.Grid';
//
import floor_vapor_barrier_installed from './_assets/floor_vapor_barrier_installed.jpg';
import floor_insulation_installed from './_assets/floor_insulation_installed.jpg';
import floor_insulation_thickness from './_assets/floor_insulation_thickness.jpg';
//
import wall_liquid_air_barrier from './_assets/wall_liquid_air_barrier.jpg';
import wall_thickness from './_assets/wall_thickness.jpg';
import wall_insulation_install from './_assets/wall_insulation_install.jpg';
import wall_ext_insulation_thickness from './_assets/wall_ext_insulation_thickness.jpg';
import wall_facade_clips from './_assets/wall_facade_clips.jpg';
//
import roof_air_barrier from './_assets/roof_air_barrier.jpg';
import roof_joist_thickness from './_assets/roof_joist_thickness.jpg';
import roof_batt_insulation from './_assets/roof_batt_insulation.jpg';
import roof_ext_insulation from './_assets/roof_ext_insulation.jpg';
import roof_ext_insulation_thickness from './_assets/roof_ext_insulation_thickness.jpg';
import { Box } from '@mui/material';

// Required Site Photos listing
const onGradeFloorAssemblies = [
    { src: floor_insulation_installed, captions: ['Any insulation products installed in place.'] },
    {
        src: floor_vapor_barrier_installed,
        captions: [
            'Any air/vapor-barrier products, installed in place.',
            'Show joint / penetration sealing method / detail.',
        ],
    },
    { src: floor_insulation_thickness, captions: ['Show installed insulation thickness using a ruler in the image.'] },
];

const wallAssemblies = [
    {
        src: wall_liquid_air_barrier,
        captions: [
            'Any liquid applied air/vapor control layers installed.',
            'Include photo of the product container showing the material brand / type used.',
        ],
    },
    {
        src: wall_thickness,
        captions: ['Any wall framing member thickness with a ruler in the image.'],
    },
    {
        src: wall_insulation_install,
        captions: [
            'Any wall insulation (batt, spray, or continuous) installed.',
            'Include photo of the product wrapper / stamp showing the material brand / type used.',
            'Include a ruler to show the installed thickness.',
        ],
    },
    {
        src: wall_ext_insulation_thickness,
        captions: ['Any exterior insulation installed, thickness shown using a ruler in the photo.'],
    },
    {
        src: wall_facade_clips,
        captions: ['Any facade clips or other attachment system.'],
    },
];

const roofAssemblies = [
    {
        src: roof_joist_thickness,
        captions: ['Any roof framing member thickness with a ruler in the image.'],
    },
    {
        src: roof_batt_insulation,
        captions: ['Any insulation products installed within the framing cavities, and/or continuous insulation used.'],
    },
    { src: roof_air_barrier, captions: ['Any installed air / moisture-vapor control membranes or layers.'] },
    { src: roof_ext_insulation, captions: ['Any exterior roof insulation layers installed.'] },
    {
        src: roof_ext_insulation_thickness,
        captions: ['Any exterior roof insulation layers with a ruler to show thickness.'],
    },
];
const EnvelopeSitePhotosPage: React.FC = () => {
    const { projectId } = useParams();

    return (
        <>
            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos [Floor Assemblies]:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the on-grade floor assemblies and materials listed in the [Materials section](material-layers):"
                    requiredPhotos={onGradeFloorAssemblies}
                />
            </ContentBlock>

            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos [Wall Assemblies]:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the wall assemblies and materials listed in the [Materials section](material-layers):"
                    requiredPhotos={wallAssemblies}
                />
            </ContentBlock>

            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos [Roof Assemblies]:" />
                <RequiredSitePhotosGrid
                    title="The following site-photos are required for **each** of the roof assemblies and materials listed in the [Materials section](material-layers):"
                    requiredPhotos={roofAssemblies}
                />
            </ContentBlock>

            <ContentBlock>
                <ContentBlockHeader text="Required Site Photos [Equipment]:" />
                <Box p={2}>
                    Note that in addition to the envelope photos listed above, site-photos for all equipment are also
                    required. Please review then <a href={`/project/${projectId}/equipment-data`}>Equipment</a> sections
                    for details.
                </Box>
            </ContentBlock>
        </>
    );
};

export default EnvelopeSitePhotosPage;
