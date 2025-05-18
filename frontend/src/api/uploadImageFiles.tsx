import constants from "../data/constants.json";

export async function uploadImageFiles<T>(
    projectId: string | undefined,
    segmentId: number,
    files: FileList,
): Promise<(T | null)[]> {
    const token = localStorage.getItem("token");
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}gcp/upload-segment-photo/${projectId}`;

    const results: (T | null)[] = [];

    for (const file of files) {
        const formData = new FormData();
        formData.append("segment_id", segmentId.toString());
        formData.append("file", file);

        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error: ${response.status} - ${errorText}`);
            alert(`Error: ${response.status} - ${errorText}`);
            results.push(null);
            continue;
        }

        const data = await response.json();
        results.push(data as T);
    }

    return results;
}