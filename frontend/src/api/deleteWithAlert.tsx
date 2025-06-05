import constants from "../data/constants.json";

/**
 * Sends a DELETE request to the specified API endpoint with an optional authorization token.
 * If the token is not provided, it attempts to retrieve it from localStorage.
 * Displays an alert in case of an error response from the server.
 *
 * @template T - The expected type of the response data.
 * @param {string} endpoint - The API endpoint to send the DELETE request to.
 * @param {string | null} [token=null] - The optional authorization token. If not provided, it will be retrieved from localStorage.
 * @param {any} [params={}] - Any params to include in the request body, serialized as JSON.
 * @returns {Promise<T | null>} - A promise that resolves to the response data of type `T` if the request is successful, or `null` if an error occurs.
 *
 * @throws {Error} - Throws an error if the fetch request fails unexpectedly.
 *
 * @example
 * ```typescript
 * const result = await deleteWithAlert<MyResponseType>('/api/resource/123', 'my-auth-token');
 * if (result) {
 *     console.log('Resource deleted successfully:', result);
 * } else {
 *     console.error('Failed to delete the resource.');
 * }
 * ```
 */
export async function deleteWithAlert<T>(
    endpoint: string,
    token: string | null = null,
    params: any = {}
): Promise<T | null> {
    console.log(`deleteWithAlert: endpoint=/${endpoint}, token=${token ? token.substring(0, 5) : ""}..., params=${JSON.stringify(params)}`);

    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem("token");
    }

    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`;

    // Call the backend API to delete the layer
    // Delete returns a 204 No Content response, so we don't expect a body
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: params ? JSON.stringify(params) : undefined,
        });

        if (response.status === 204) {
            // No content response - return a non-null value so calling code knows it succeeded
            return true as T;  // or just return true
        } else {
            alert(`Error: ${response.status} - ${response.statusText}`);
            return null;
        }

    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        alert(`Error: ${error.message}`);
        return null;
    }
}