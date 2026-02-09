// frontend/src/lib/api.ts
export const API_BASE = '/api';

export type ApiError = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: string;
    token?: string | null;
    body?: any;
    headers?: Record<string, string>;
    cache?: RequestCache;
  } = {},
): Promise<T> {
  const { method = 'GET', token = null, body, headers = {}, cache = 'no-store' } = opts;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const err: ApiError = data || { message: text || 'Request failed' };
    err.statusCode = err.statusCode ?? res.status;
    throw err;
  }

  return data as T;
}

// helper pra upload FormData
export async function apiUpload<T>(
  path: string,
  opts: { token: string; formData: FormData; method?: string },
): Promise<T> {
  const { token, formData, method = 'POST' } = opts;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const err: ApiError = data || { message: text || 'Upload failed' };
    err.statusCode = err.statusCode ?? res.status;
    throw err;
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
