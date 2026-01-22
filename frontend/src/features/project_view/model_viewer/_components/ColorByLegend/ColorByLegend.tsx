// Floating legend displaying color meanings for ColorBy visualization mode

import { useAppVizStateContext } from '../../_contexts/app_viz_state_context';
import { useColorByContext, ColorByAttribute } from '../../_contexts/color_by_context';
import { appVizStateTypeEnum } from '../../states/VizState';
import {
    faceTypeColors,
    boundaryColors,
    ventilationAirflowColors,
    floorWeightingFactorColors,
    getLegendItems,
    ColorDefinition,
} from '../../_constants/colorByColors';
import './ColorByLegend.css';

// Legend item component - renders a single color swatch with label
function LegendItem({ item }: { item: ColorDefinition }) {
    return (
        <div className="color-by-legend-item">
            <div className="color-by-legend-swatch" style={{ backgroundColor: item.hex }} />
            <span className="color-by-legend-label">{item.label}</span>
        </div>
    );
}

// Get legend title based on current attribute
function getLegendTitle(attribute: ColorByAttribute): string {
    switch (attribute) {
        case ColorByAttribute.FaceType:
            return 'Face Type';
        case ColorByAttribute.Boundary:
            return 'Boundary';
        case ColorByAttribute.OpaqueConstruction:
            return 'Opaque Construction';
        case ColorByAttribute.ApertureConstruction:
            return 'Aperture Construction';
        case ColorByAttribute.VentilationAirflow:
            return 'Ventilation Airflow';
        case ColorByAttribute.FloorWeightingFactor:
            return 'Floor Weighting Factor';
        default:
            return 'Legend';
    }
}

// Get legend items based on current attribute
function getLegendItemsForAttribute(attribute: ColorByAttribute, dynamicItems: ColorDefinition[]): ColorDefinition[] {
    switch (attribute) {
        case ColorByAttribute.FaceType:
            return getLegendItems(faceTypeColors);
        case ColorByAttribute.Boundary:
            return getLegendItems(boundaryColors);
        case ColorByAttribute.VentilationAirflow:
            return getLegendItems(ventilationAirflowColors);
        case ColorByAttribute.FloorWeightingFactor:
            return getLegendItems(floorWeightingFactorColors);
        case ColorByAttribute.OpaqueConstruction:
        case ColorByAttribute.ApertureConstruction:
            // Sort dynamic items alphabetically for consistency
            return [...dynamicItems].sort((a, b) => a.label.localeCompare(b.label));
        default:
            return [];
    }
}

export default function ColorByLegend() {
    const { appVizState } = useAppVizStateContext();
    const { colorByAttribute, dynamicLegendItems } = useColorByContext();

    // Only show legend when in ColorBy mode
    const isVisible = appVizState.vizState === appVizStateTypeEnum.ColorBy;

    if (!isVisible) {
        return null;
    }

    const title = getLegendTitle(colorByAttribute);
    const items = getLegendItemsForAttribute(colorByAttribute, dynamicLegendItems);

    return (
        <div className="color-by-legend">
            <div className="color-by-legend-title">{title}</div>
            <div className="color-by-legend-items">
                {items.map(item => (
                    <LegendItem key={item.label} item={item} />
                ))}
            </div>
        </div>
    );
}
