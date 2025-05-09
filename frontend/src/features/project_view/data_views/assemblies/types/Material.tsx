export interface Material {
    // Define the structure of a material object based on your API response
    id: string;
    name: string;
    emissivity: number;
    conductivity_w_mk: number;
    category: string;
    argb_color: string;
    [key: string]: any; // Add additional fields as needed
}

export interface UseLoadMaterialsReturn {
    isLoadingMaterials: boolean;
    materials: Material[];
}