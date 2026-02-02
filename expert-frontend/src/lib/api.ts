const rawBase =
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_API_URL ??
  '';

function normalizeBase(input?: string) {
  const v = (input ?? '').trim();

  if (!v) return 'http://localhost:3000';
  const low = v.toLowerCase();
  if (low === 'undefined' || low === 'null') return 'http://localhost:3000';

  return v.replace(/\/+$/, '');
}

export const API_BASE = normalizeBase(rawBase);

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

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
