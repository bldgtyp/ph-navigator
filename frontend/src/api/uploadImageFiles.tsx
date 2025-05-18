import constants from "../data/constants.json";

export async function uploadImageFile<T>(
    projectId: string | undefined,
    file: any,
): Promise<T | null> {
    const token = localStorage.getItem("token");

    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}gcp/generate-upload-url/${projectId}`;

    const formData = new FormData();
    formData.append("filename", file.name);

    // ----------------------------------------------------------------------------------
    // Step 1: Generate the signed upload URL
    const generateUrlResponse = await fetch(
        API_ENDPOINT,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData
        }
    );

    if (!generateUrlResponse.ok) {
        const errorText = await generateUrlResponse.text();
        console.error(`Error: ${generateUrlResponse.status} - ${errorText}`);
        alert(`Error: ${generateUrlResponse.status} - ${errorText}`);
        return null;
    }

    const responseData: { url: string } = await generateUrlResponse.json();

    // ----------------------------------------------------------------------------------
    // Step 2: upload file to GCS using signed URL
    const uploadResponse = await fetch(responseData.url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/octet-stream",
        },
        body: file,
    });

    if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`Error: ${uploadResponse.status} - ${errorText}`);
        alert(`Error: ${uploadResponse.status} - ${errorText}`);
        return null;
    }

    return null;
}