// frontend/src/lib/api.ts

export type ApiError = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

const API_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? '').trim();
  const low = raw.toLowerCase();
  if (!raw || low === 'undefined' || low === 'null') return '';
  return raw.replace(/\/+$/, '');
})();

function joinUrl(base: string, path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!base) return p; // fallback (dev local)
  return `${base}${p}`;
}

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

  const res = await fetch(joinUrl(API_BASE, path), {
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

  const res = await fetch(joinUrl(API_BASE, path), {
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
