import constants from "../data/constants.json";


async function fetchUserData<T>(
    endpoint: string,
    token: string | null = null,
    params: Record<string, string | number> = {}
): Promise<{ data: T | null, error: any }> {

    // If token is not provided, try to get it from localStorage
    if (!token) {
        token = localStorage.getItem("token");
    }

    if (!token) {
        return { data: null, error: "No Access Token." };
    }

    console.log(`fetchModelServer: endpoint=/${endpoint}, token=${token.substring(0, 5)}..., params=${JSON.stringify(params)}`);
    const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    const API_ENDPOINT: string = `${API_BASE_URL}${endpoint}`

    // Add query parameters to the URL
    const url = new URL(API_ENDPOINT);
    Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

    // Delay for Testing...
    // await new Promise(resolve => setTimeout(resolve, 1000)); // 1/2 second delay

    console.log(url.toString())
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
        const txt: any = await response.json();
        console.log(`HTTP error [${response.status}] ${txt.detail} | ${API_ENDPOINT}`);
        return { data: null, error: `HTTP error [${response.status}] ${txt.detail} | ${API_ENDPOINT}` };
    }

    const data: T = await response.json();
    console.log("returning from fetchModelServer...")
    return { data, error: null };

}

export async function fetchWithModal<T>(endpoint: string, token: string | null = null, params: Record<string, string | number> = {}): Promise<T | null> {
    const { data, error } = await fetchUserData<T>(endpoint, token, params);
    if (error) {
        const message = `Error getting data: ${error}`;
        alert(message);
        return null;
    } else {
        return data;
    }
}