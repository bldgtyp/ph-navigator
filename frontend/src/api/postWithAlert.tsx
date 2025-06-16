import constants from '../data/constants.json';

/**
 * Sends a POST request to the specified API endpoint with the provided data and token.
 * Displays an alert if the request fails.
 *
 * @template T - The expected type of the response data.
 * @param {string} endpoint - The API endpoint to send the request to (relative to the base URL).
 * @param {string | null} [token=null] - The authorization token to include in the request headers.
 * If not provided, it will attempt to retrieve the token from localStorage.
 * @param {any} [data={}] - The data to include in the request body, serialized as JSON.
 * @returns {Promise<T | null>} - A promise that resolves to the response data of type `T` if the request is successful,
 * or `null` if the request fails.
 *
 * @throws {Error} - Throws an error if the fetch request encounters a network issue.
 *
 * @example
 * ```typescript
 * const response = await postWithAlert<MyResponseType>('/api/example', 'my-token', { key: 'value' });
 * if (response) {
 *     console.log('Success:', response);
 * } else {
 *     console.error('Request failed');
 * }
 * ```
 */
export async function postWithAlert<T>(
    endpoint: string,
    token: string | null = null,
    data: any = {}
): Promise<T | null> {
    console.log(
        `postWithAlert: endpoint=/${endpoint}, token=${token ? token.substring(0, 5) : ''}..., data=${JSON.stringify(data)}`
    );

    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem('token');
    }

    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`;

    // Define the fetch options
    const options: RequestInit = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
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
