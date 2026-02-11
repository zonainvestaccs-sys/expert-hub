import { apiFetch } from './api';

export type AppRole = 'ADMIN' | 'EXPERT';

export type Me = {
  id: string;
  email: string;
  role: AppRole;
  isActive: boolean;
  createdAt?: string;
  photoUrl?: string | null;
};

type LoginResponse = {
  access_token: string;
};

const TOKEN_KEY = 'experthub_token';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function setToken(token: string) {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<string> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (!data?.access_token) {
    throw { statusCode: 401, message: 'Falha no login' };
  }

  setToken(data.access_token);
  return data.access_token;
}

export async function fetchMe(token?: string | null): Promise<Me> {
  const t = token ?? getToken();
  if (!t) throw { statusCode: 401, message: 'Sem token' };

  return apiFetch<Me>('/auth/me', {
    method: 'GET',
    token: t,
  });
}

/* =========================================================
 * ✅ NOVO: ExpertMe + fetchExpertMe (não quebra /auth/me)
 * ========================================================= */

export type ExpertMe = Me & {
  whatsappBlastEnabled?: boolean;
  whatsappBlastIframeUrl?: string | null;
};

export async function fetchExpertMe(token?: string | null): Promise<ExpertMe> {
  const t = token ?? getToken();
  if (!t) throw { statusCode: 401, message: 'Sem token' };

  // ✅ endpoint do ExpertController que você já criou
  return apiFetch<ExpertMe>(`/expert/me?ts=${Date.now()}`, {
    method: 'GET',
    token: t,
  });
}
