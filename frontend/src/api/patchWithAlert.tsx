import constants from "../data/constants.json";

/**
 * Sends a PATCH request to the specified API endpoint with the provided data and token.
 * Displays an alert in case of an error response from the server.
 *
 * @template T - The expected type of the response data.
 * @param {string} endpoint - The API endpoint to send the PATCH request to.
 * @param {string | null} [token=null] - The authorization token. If not provided, it will attempt to retrieve it from localStorage.
 * @param {any} [data={}] - The data to be sent in the request body.
 * @returns {Promise<T | null>} - Resolves with the response data of type `T` if the request is successful, or `null` if an error occurs.
 *
 * @throws {Error} - Throws an error if the fetch request fails due to network issues or other unexpected errors.
 *
 * @example
 * ```typescript
 * const updatedData = await patchWithAlert<MyResponseType>('/api/resource', 'my-token', { key: 'value' });
 * if (updatedData) {
 *     console.log('Update successful:', updatedData);
 * } else {
 *     console.error('Update failed.');
 * }
 * ```
 */
export async function patchWithAlert<T>(
    endpoint: string,
    token: string | null = null,
    data: any = {}
): Promise<T | null> {
    console.log(`patchWithAlert: endpoint=/${endpoint}, token=${token ? token.substring(0, 5) : ""}..., data=${JSON.stringify(data)}`);

    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem("token");
    }

    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`;

    // Define the fetch options
    const options: RequestInit = {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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