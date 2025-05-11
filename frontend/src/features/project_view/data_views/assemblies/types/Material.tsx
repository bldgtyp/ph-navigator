export interface MaterialType {
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
    setIsLoadingMaterials: React.Dispatch<React.SetStateAction<boolean>>;
    materials: MaterialType[];
    setMaterials: React.Dispatch<React.SetStateAction<MaterialType[]>>;
}

export const convertArgbToRgba = (argbColor: string | null | undefined, defaultColor: string = "#ccc"): string => {
    if (!argbColor) return defaultColor; // Fallback to default color if argbColor is null or undefined

    // Remove the "(" prefix and ")" suffix
    argbColor = argbColor.replace("(", "").replace(")", "");

    // Split the string into an array of numbers
    const [a, r, g, b] = argbColor.split(",").map((value) => parseFloat(value.trim()));
    const alpha = a / 255; // Convert alpha from 0-255 to 0-1 range
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};