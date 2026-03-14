import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://ehestudio-ops-api.onrender.com';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

let refreshPromise: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    await SecureStore.setItemAsync('access_token', data.access_token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const makeHeaders = async (): Promise<Record<string, string>> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };
    const accessToken = await SecureStore.getItemAsync('access_token');
    if (accessToken) {
      h['Authorization'] = `Bearer ${accessToken}`;
    }
    return h;
  };

  const fetchOptions: RequestInit = {
    ...rest,
    headers: await makeHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  };

  let response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  // On 401, try refreshing the token and retry once (skip for auth endpoints)
  if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...rest,
        headers: await makeHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    if (response.status === 401) {
      // Token refresh failed — clear and redirect
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      onUnauthorized?.();
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, errorData.error ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
