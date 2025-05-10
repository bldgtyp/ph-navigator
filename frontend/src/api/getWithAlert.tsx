import constants from "../data/constants.json";

/**
 * Fetches data from a specified API endpoint with optional query parameters and token-based authentication.
 * Displays an alert if the HTTP response is not successful.
 *
 * @template T - The expected type of the response data.
 * @param {string} endpoint - The API endpoint to fetch data from (relative to the base URL).
 * @param {string | null} [token=null] - The authentication token for the request. If not provided, it will attempt to retrieve it from localStorage.
 * @param {Record<string, string | number>} [params={}] - An object representing query parameters to be appended to the URL.
 * @returns {Promise<T | null>} - A promise that resolves to the fetched data of type `T` if the request is successful, or `null` if the request fails.
 *
 * @throws {Error} - Throws an error if the `REACT_APP_API_URL` environment variable or `constants.RENDER_API_BASE_URL` is not defined.
 *
 * @remarks
 * - The function logs the endpoint, token (partially masked), and query parameters to the console for debugging purposes.
 * - If the HTTP response is not successful, an alert is displayed with the error details.
 * - The function assumes that the API returns JSON data.
 *
 * @example
 * ```typescript
 * const data = await fetchWithAlert<MyDataType>('/example-endpoint', 'my-auth-token', { page: 1, limit: 10 });
 * if (data) {
 *     console.log(data);
 * }
 * ```
 */
export async function getWithAlert<T>(
    endpoint: string,
    token: string | null = null,
    params: Record<string, string | number> = {}
): Promise<T | null> {

    // -----------------------------------------------------------------------------------------------------------------
    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem("token");
    }

    console.log(`getWithAlert: endpoint=/${endpoint}, token=${token ? token.substring(0, 5) : ""}..., params=${JSON.stringify(params)}`);

    // -----------------------------------------------------------------------------------------------------------------
    // Define the API base URL and endpoint
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`

    // -----------------------------------------------------------------------------------------------------------------
    // Add query parameters to the URL
    const url = new URL(API_ENDPOINT);
    Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

    // Delay (for testing)
    // await new Promise(resolve => setTimeout(resolve, 1000)); // 1/2 second delay

    // -----------------------------------------------------------------------------------------------------------------
    // Define the fetch options
    const options: RequestInit = {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json", // Set Content-Type for JSON payloads
        },
    };

    // -----------------------------------------------------------------------------------------------------------------
    // Make the fetch request
    const response = await fetch(url.toString(), options);

    // -----------------------------------------------------------------------------------------------------------------
    // Display an alert if the response is not ok
    if (response.ok) {
        const data = await response.json()
        return data;
    } else {
        const txt: any = await response.json();
        const message = `HTTP error [${response.status}] ${txt.detail} | ${API_ENDPOINT}`;
        console.error(message);
        alert(message);
        return null;
    }
}