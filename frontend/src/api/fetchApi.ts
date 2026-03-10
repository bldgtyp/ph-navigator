import constants from '../data/constants.json';

const API_BASE_URL: string = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;

function getToken(): string | null {
    return localStorage.getItem('token');
}

function authHeaders(token?: string | null): Record<string, string> {
    const t = token ?? getToken();
    return {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/json',
    };
}

async function handleErrorResponse(response: Response, endpoint: string): Promise<never> {
    let detail: string;
    try {
        const body = await response.json();
        detail = body.detail || JSON.stringify(body);
    } catch {
        detail = response.statusText;
    }
    throw new Error(`HTTP error [${response.status}] ${detail} | ${endpoint}`);
}

export async function fetchGet<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, String(params[key])));

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authHeaders(),
    });

    if (!response.ok) await handleErrorResponse(response, endpoint);
    return response.json();
}

export async function fetchPost<T>(endpoint: string, data: any = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });

    if (!response.ok) await handleErrorResponse(response, endpoint);
    return response.json();
}

export async function fetchPatch<T>(endpoint: string, data: any = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });

    if (!response.ok) await handleErrorResponse(response, endpoint);
    return response.json();
}

export async function fetchDelete<T>(endpoint: string, params: any = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
            ...authHeaders(),
        },
        body: params && Object.keys(params).length > 0 ? JSON.stringify(params) : undefined,
    });

    if (response.status === 204) return true as T;
    if (!response.ok) await handleErrorResponse(response, endpoint);
    return response.json();
}

export async function fetchPostFile<T>(endpoint: string, file: File): Promise<T> {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: (() => {
            const fd = new FormData();
            fd.append('file', file);
            return fd;
        })(),
    });

    if (!response.ok) await handleErrorResponse(response, endpoint);
    return response.json();
}
