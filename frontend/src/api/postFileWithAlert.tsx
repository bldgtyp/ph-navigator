import constants from "../data/constants.json";

export async function postFileWithAlert<T>(
    endpoint: string,
    token: string | null = null,
    file: File,
): Promise<T | null> {
    console.log(`postWithAlert: endpoint=/${endpoint}, token=${token ? token.substring(0, 5) : ""}..., file=${file.name}`);

    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem("token");
    }

    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`;

    // Create a FormData object to hold the file
    const formData = new FormData();
    formData.append("file", file);

    // Define the fetch options
    const options: RequestInit = {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`
        },
        body: formData,
    };

    // Make the fetch request
    const response = await fetch(API_ENDPOINT, options);

    if (response.ok) {
        const responseData = await response.json();
        return responseData;
    } else {
        const errorText = await response.text();
        console.error(`Error: ${response.status} - ${errorText}`);
        alert(`Error: ${response.status} - ${errorText}`);
        return null;
    }
}