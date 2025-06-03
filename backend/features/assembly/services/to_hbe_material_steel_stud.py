# -*- Python Version: 3.11 (Render.com) -*

import logging

from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_ph_utils.aisi_s250_21 import (
    STEEL_CONDUCTIVITY,
    StudSpacingInches,
    StudThicknessMil,
    calculate_stud_cavity_effective_u_value,
)
from ph_units.converter import convert

from db_entities.assembly import Layer
from features.assembly.services.to_hbe_material_typical import (
    convert_multiple_assembly_layers_to_hb_material,
    convert_single_assembly_layer_to_hb_material,
)

logger = logging.getLogger(__name__)


class SteelStudLayersCollection:
    """Class to organize the layers of a Steel Stud Assembly."""

    STUD_FLANGE_WIDTH_INCH = 1.625
    R_SE = 0.17  # hr-ft2-F/Btu
    R_SI = 0.68  # hr-ft2-F/Btu

    def __init__(self, stud_cavity_layer: EnergyMaterial) -> None:
        self.stud_cavity_layer = stud_cavity_layer
        self.ext_cladding: list[EnergyMaterial] = []
        self.ext_insulation_layers: list[EnergyMaterial] = []
        self.ext_sheathing_layers: list[EnergyMaterial] = []
        self.int_sheathing_layers: list[EnergyMaterial] = []

    def __str__(self) -> str:
        def layer_view(layer: EnergyMaterial, r_value: float):
            return f"Layer: {layer.display_name} | {layer.thickness}-m | R-{r_value:.2f}"

        msg = " -" * 25 + "\n"
        msg += "SteelStudAssemblyLayers()\n"
        msg += "- ext_cladding Layers:\n"
        for layer in self.ext_cladding:
            msg += layer_view(layer, self.r_IP_value_ext_cladding)
        msg += "- ext_insulation Layers:\n"
        for layer in self.ext_insulation_layers:
            msg += layer_view(layer, self.r_IP_value_ext_insulation)
        msg += "- ext_sheathing Layers:\n"
        for layer in self.ext_sheathing_layers:
            msg += layer_view(layer, self.r_IP_value_ext_sheathing)
        msg += "- stud_cavity Layer:\n"
        if self.stud_cavity_layer:
            msg += layer_view(self.stud_cavity_layer, self.r_IP_value_stud_cavity_insulation)
        else:
            msg += "  None\n"
        msg += "- int_sheathing Layers:\n"
        for layer in self.int_sheathing_layers:
            msg += layer_view(layer, self.r_IP_value_int_sheathing)
        return msg

    @classmethod
    def sort_layers_into_groups(cls, layers: list[Layer]) -> tuple[dict, dict]:
        """Sort the layers into groups based on their type / order."""

        # Group the layers into three groups: exterior, the cavity, and interior
        layer_groups: dict[int, list[Layer]] = {
            0: [],  # Exterior Layers
            1: [],  # the Stud Cavity
            2: [],  # Interior Layers
        }
        current_layer_group: list[Layer] = layer_groups[0]
        for layer in layers:
            if layer.is_steel_stud_layer:
                layer_groups[1].append(layer)  # Store the Cavity Layer
                # Switch to the Interior Layer group (pos-2)
                current_layer_group = layer_groups[2]
            else:
                current_layer_group.append(layer)

        # Group the Exterior layers into their categories
        exterior_layer_groups = {
            0: [],  # claddings
            1: [],  # insulation
            2: [],  # sheathings
        }
        current_layer_group = exterior_layer_groups[0]
        for i, layer in enumerate(layer_groups[0]):
            if layer.is_continuous_insulation_layer:
                exterior_layer_groups[1].append(layer)

                # Change to the next layer Group UNLESS the next layer is more insulation
                if i < len(layer_groups[0]) - 1:
                    next_layer = layer_groups[0][i + 1]
                    if not next_layer.is_continuous_insulation_layer:
                        current_layer_group = exterior_layer_groups[2]
            else:
                current_layer_group.append(layer)

        return layer_groups, exterior_layer_groups

    @classmethod
    def from_layers(cls, layers: list[Layer]) -> "SteelStudLayersCollection":
        """Create a SteelStudAssemblyLayers object from a list of layers."""
        logger.info(f"SteelStudAssemblyLayers.from_layers([{len(layers)}] layers)")

        layer_groups, exterior_layer_groups = cls.sort_layers_into_groups(layers)
        cavity_layer_hbe_material = convert_single_assembly_layer_to_hb_material(layer_groups[1][0])
        steel_stud_assembly_layers = cls(cavity_layer_hbe_material)
        steel_stud_assembly_layers.ext_cladding = convert_multiple_assembly_layers_to_hb_material(
            exterior_layer_groups[0]
        )
        steel_stud_assembly_layers.ext_insulation_layers = convert_multiple_assembly_layers_to_hb_material(
            exterior_layer_groups[1]
        )
        steel_stud_assembly_layers.ext_sheathing_layers = convert_multiple_assembly_layers_to_hb_material(
            exterior_layer_groups[2]
        )
        steel_stud_assembly_layers.int_sheathing_layers = convert_multiple_assembly_layers_to_hb_material(
            layer_groups[2]
        )

        return steel_stud_assembly_layers

    @property
    def r_IP_value_ext_cladding(self) -> float:
        """Get the R-value of the exterior cladding in IP units (hr-ft2-F/Btu)."""
        r_value = 0.0
        for layer in self.ext_cladding:
            r_value += convert(layer.r_value, "M2-K/W", "HR-FT2-F/BTU") or 0.0
        return r_value

    @property
    def r_IP_value_ext_insulation(self) -> float:
        """Get the R-value of the exterior insulation in IP units (hr-ft2-F/Btu)."""
        r_value = 0.0
        for layer in self.ext_insulation_layers:
            r_value += convert(layer.r_value, "M2-K/W", "HR-FT2-F/BTU") or 0.0
        return r_value

    @property
    def r_IP_value_ext_sheathing(self) -> float:
        """Get the R-value of the exterior sheathing in IP units (hr-ft2-F/Btu)."""
        r_value = 0.0
        for layer in self.ext_sheathing_layers:
            r_value += convert(layer.r_value, "M2-K/W", "HR-FT2-F/BTU") or 0.0
        return r_value

    @property
    def r_IP_value_stud_cavity_insulation(self) -> float:
        """Get the R-value of the stud cavity insulation in IP units (hr-ft2-F/Btu)."""
        if self.stud_cavity_layer:
            return convert(self.stud_cavity_layer.r_value, "M2-K/W", "HR-FT2-F/BTU") or 0.0
        return 0.0

    @property
    def r_IP_value_int_sheathing(self) -> float:
        """Get the R-value of the interior sheathing in IP units (hr-ft2-F/Btu)."""
        r_value = 0.0
        for layer in self.int_sheathing_layers:
            r_value += convert(layer.r_value, "M2-K/W", "HR-FT2-F/BTU") or 0.0
        return r_value

    @property
    def stud_depth_inch(self) -> float:
        """Get the stud depth in inches."""
        if self.stud_cavity_layer:
            return convert(self.stud_cavity_layer.thickness or 0.0, "M", "INCH") or 0.0
        return 0.0

    @property
    def stud_depth_m(self) -> float:
        """Get the stud depth in meters."""
        if self.stud_cavity_layer:
            return self.stud_cavity_layer.thickness or 0.0
        return 0.0


def calculate_steel_stud_eq_conductivity(
    stl_stud_layers: SteelStudLayersCollection,
) -> float:
    """Return equivalent conductivity (W/m-K) of a steel-stud assembly's stud-cavity."""
    logger.info(f"calculate_steel_stud_eq_conductivity({stl_stud_layers.stud_cavity_layer.identifier})")

    # Note: all values need to be converted to 'IP' units for this calculation
    u_IP = calculate_stud_cavity_effective_u_value(
        _r_ext_cladding=stl_stud_layers.r_IP_value_ext_cladding,
        _r_ext_insulation=stl_stud_layers.r_IP_value_ext_insulation,
        _r_ext_sheathing=stl_stud_layers.r_IP_value_ext_sheathing,
        _r_cavity_insulation=stl_stud_layers.r_IP_value_stud_cavity_insulation,
        _stud_spacing_inch=StudSpacingInches("16"),
        _stud_thickness_mil=StudThicknessMil("43"),
        _stud_flange_width_inch=stl_stud_layers.STUD_FLANGE_WIDTH_INCH,  # inch
        _stud_depth_inch=stl_stud_layers.stud_depth_inch,
        _steel_conductivity=STEEL_CONDUCTIVITY[StudThicknessMil("43")],
        _r_int_sheathing=stl_stud_layers.r_IP_value_int_sheathing,
        _r_se=stl_stud_layers.R_SE,
        _r_si=stl_stud_layers.R_SI,
    )
    u_SI = convert(u_IP, "BTU/HR-FT2-F", "W/M2-K")
    if not u_SI:
        raise ValueError(f"Failed to convert U-value: {u_IP} from IP to SI units.")

    conductivity_W_mk = u_SI * (stl_stud_layers.stud_depth_m)

    return conductivity_W_mk


def get_steel_stud_layers_as_hb_materials(
    layers: list[Layer],
) -> list[EnergyMaterial]:
    logger.info(f"get_steel_stud_layers_as_hb_materials([{len(layers)}] layers)")

    # Calc the stud-cavity equivalent thermal conductivity
    steel_stud_assembly_hbe_materials = SteelStudLayersCollection.from_layers(layers)
    stud_layer_eq_conductivity_w_mk = calculate_steel_stud_eq_conductivity(steel_stud_assembly_hbe_materials)

    # Build the stud layer's  Honeybee-Energy Material
    new_eq_stud_layer_material = EnergyMaterial(
        identifier="Steel-Stud Layer [" + steel_stud_assembly_hbe_materials.stud_cavity_layer.identifier + "]",
        thickness=steel_stud_assembly_hbe_materials.stud_depth_m,
        conductivity=stud_layer_eq_conductivity_w_mk,
        density=steel_stud_assembly_hbe_materials.stud_cavity_layer.density,
        specific_heat=steel_stud_assembly_hbe_materials.stud_cavity_layer.specific_heat,
    )

    # Build the list of materials for the Assembly
    hbe_materials = [
        *steel_stud_assembly_hbe_materials.ext_cladding,
        *steel_stud_assembly_hbe_materials.ext_insulation_layers,
        *steel_stud_assembly_hbe_materials.ext_sheathing_layers,
        new_eq_stud_layer_material,
        *steel_stud_assembly_hbe_materials.int_sheathing_layers,
    ]

    return hbe_materials
